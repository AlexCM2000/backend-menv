import Appointment from "../models/Appointment.js"
import Health from "../models/HealthCenter.js";
import User from "../models/User.js";
import Patient from "../models/Patient.js";

// Busca citas por nombre buscando en User Y Patient (para citas sin cuenta de usuario)
const applySearchFilter = async (query, searchName) => {
    const nameRegex = { $regex: searchName, $options: "i" };
    const nameCondition = [
        { primerApellido: nameRegex },
        { segundoApellido: nameRegex },
        { nombres: nameRegex },
        { email: nameRegex },
    ];

    const [users, patients] = await Promise.all([
        User.find({ $or: nameCondition }).select("_id"),
        Patient.find({ $or: nameCondition, eliminado_en: null }).select("_id"),
    ]);

    const userIds = users.map(u => u._id);
    const patientIds = patients.map(p => p._id);

    if (!userIds.length && !patientIds.length) {
        query.__emptySearch = true;
        return;
    }

    const conditions = [];
    if (userIds.length) conditions.push({ user: { $in: userIds } });
    if (patientIds.length) conditions.push({ patient: { $in: patientIds } });
    query.$or = conditions;
};

const getUserAppointments = async (req, res) => {
    const healthCode = req.query.health; // Capturamos el código de health desde los query parameters
    const searchName = req.query.search; // Capturamos el nombre del paciente desde los query parameters

    // Verificar que el usuario esté autenticado
    if (!req.user) {
        return res.status(403).json({ msg: "No autorizado: Usuario no autenticado" });
    }

    try {
        // Obtener parámetros de paginación de la solicitud
        const { page = 1, page_size = 10 } = req.query; // Establecer valores predeterminados

        // Construir la consulta base
        let query ={}

        // Filtrar según el tipo de usuario
        if (req.user.admin) {
            // Si el usuario es admin, incluir la lógica de health
            if (healthCode) {
                const healthRecord = await Health.findOne({ codigo: healthCode });
                if (!healthRecord) {
                    return res.status(404).json({ message: "Centro de salud no encontrado." });
                }
                query.health = healthRecord._id;
            }
            if (searchName) {
                await applySearchFilter(query, searchName);
                if (query.__emptySearch) return res.json({ page, page_size, count: 0, results: [] });
                delete query.__emptySearch;
            }
        } else if (req.user.branchManager) {
            // Si el usuario es branchManager, filtrar por su centro de salud
            query.health = req.user.health;
            if (searchName) {
                await applySearchFilter(query, searchName);
                if (query.__emptySearch) return res.json({ page, page_size, count: 0, results: [] });
                delete query.__emptySearch;
            }
        } else if (req.user.doctor && req.user.doctorProfile) {
            // Doctor: solo ve citas asignadas a su perfil de médico, en su centro de salud
            query.doctor = req.user.doctorProfile;
            if (req.user.health) query.health = req.user.health;
        } else {
            // Usuario regular: por defecto solo citas activas (Pendiente/Reprogramada)
            // Si se pasa history=true, devuelve las finalizadas de los últimos 90 días
            const showHistory = req.query.history === 'true';
            if (showHistory) {
                const ninetyDaysAgo = new Date();
                ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                query = {
                    user: req.user._id,
                    state: { $in: ['Cancelada', 'Completada', 'No asistio'] },
                    date: { $gte: ninetyDaysAgo },
                };
            } else {
                query = {
                    user: req.user._id,
                    state: { $in: ['Pendiente', 'Reprogramada'] },
                };
            }
        }

       

        // Filtro por estado de la cita
        const stateFilter = req.query.state;
        const validStates = ['Pendiente', 'Reprogramada', 'Cancelada', 'Completada', 'No asistio'];
        if (stateFilter && validStates.includes(stateFilter)) {
            query.state = stateFilter;
        }

        // Filtro por rango de fecha (admin, branchManager y doctor)
        if (req.user.admin || req.user.branchManager || req.user.doctor) {
            const { date_from, date_to } = req.query;
            if (date_from || date_to) {
                query.date = {};
                if (date_from) query.date.$gte = new Date(date_from);
                if (date_to) {
                    const end = new Date(date_to);
                    end.setHours(23, 59, 59, 999);
                    query.date.$lte = end;
                }
            }
        }

        console.log("[getUserAppointments] query:", JSON.stringify(query));
        // Realizar la consulta de citas médicas y usar populate para incluir los detalles del usuario/paciente
        const paginatedAppointments = await Appointment.find(query)
            .populate('services')
            .populate('health', 'name codigo')
            .populate('user', 'primerApellido segundoApellido nombres email susCode')
            .populate('patient', 'primerApellido segundoApellido nombres susCode')
            .populate('doctor', 'name specialty')
            .limit(page_size)
            .skip((page - 1) * page_size);

        // Contar total de citas que coinciden con la consulta
        const count = await Appointment.countDocuments(query);

        console.log("[getUserAppointments] first result user/patient:", paginatedAppointments[0]?.user, "/", paginatedAppointments[0]?.patient);
        // Devolver los resultados paginados con la información poblada
        return res.json({
            page,
            page_size,
            count,
            results: paginatedAppointments,
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error.message });
    }
};


export {
    getUserAppointments
}