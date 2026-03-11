import Appointment from "../models/Appointment.js"
import Health from "../models/HealthCenter.js";
import User from "../models/User.js";

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
                // Buscar el ObjectId correspondiente al healthCode
                const healthRecord = await Health.findOne({ codigo: healthCode });

                if (!healthRecord) {
                    return res.status(404).json({ message: "Centro de salud no encontrado." });
                }

                query.health = healthRecord._id; // Asignar el ObjectId encontrado
            }
             // Si hay un nombre de búsqueda, primero busca los usuarios
        let userIds = [];
        if (searchName) {
            const users = await User.find({
                $or: [
                    { name: { $regex: searchName, $options: "i" } },
                    { email: { $regex: searchName, $options: "i" } }
                ]
            });

            // Extraer los IDs de los usuarios encontrados
            userIds = users.map(user => user._id);
            if (userIds.length > 0) {
                query.user = { $in: userIds }; // Usar $in para buscar citas con esos usuarios
            } else {
                return res.json({ page, page_size, count: 0, results: [] }); // Si no hay usuarios, devuelve vacío
            }
        }
        } else if (req.user.branchManager) {
            // Si el usuario es branchManager, filtrar por su centro de salud
            query.health = req.user.health;
             // Si hay un nombre de búsqueda, primero busca los usuarios
        let userIds = [];
        if (searchName) {
            const users = await User.find({
                $or: [
                    { name: { $regex: searchName, $options: "i" } },
                    { email: { $regex: searchName, $options: "i" } }
                ]
            });

            // Extraer los IDs de los usuarios encontrados
            userIds = users.map(user => user._id);
            if (userIds.length > 0) {
                query.user = { $in: userIds }; // Usar $in para buscar citas con esos usuarios
            } else {
                return res.json({ page, page_size, count: 0, results: [] }); // Si no hay usuarios, devuelve vacío
            }
        }
        } else {
            // Para otros usuarios, filtrar por su ID de usuario
            console.log("ESTE ES EL USUARIO "+req.user._id)
            query = { 
                user: req.user._id, 
                date: { $gte: new Date() } 
            };
          console.log("ESTA ES LA QUERY:  =>   ")
          console.log(query)
        }

       

        // Filtro por estado de la cita
        const stateFilter = req.query.state;
        const validStates = ['Pendiente', 'Reprogramada', 'Cancelada', 'Completada', 'No asistio'];
        if (stateFilter && validStates.includes(stateFilter)) {
            query.state = stateFilter;
        }

        // Filtro por rango de fecha (solo admin y branchManager)
        if (req.user.admin || req.user.branchManager) {
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

        // Realizar la consulta de citas médicas y usar populate para incluir los detalles del usuario
        const paginatedAppointments = await Appointment.find(query)
            .populate('services') // Poblamos los servicios relacionados
            .populate('health', 'name codigo') // Poblamos los detalles del centro de salud
            .populate('user', 'name email sus') // Poblamos los detalles del usuario
            .limit(page_size)
            .skip((page - 1) * page_size);

        // Contar total de citas que coinciden con la consulta
        const count = await Appointment.countDocuments(query);

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