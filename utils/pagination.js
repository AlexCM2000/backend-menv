const paginate = async (model, page = 1, pageSize = 10, query = {}, populate = "") => {
    try {
      const skip = (page - 1) * pageSize;
  
      // Contar total de documentos
      const totalCount = await model.countDocuments(query);
  
      // Obtener resultados paginados
      const results = await model
        .find(query)
        .populate(populate)
        .skip(skip)
        .limit(pageSize)
        .exec();
  
      return {
        count: totalCount,
        page,
        page_size: pageSize,
        results,
      };
    } catch (error) {
      throw new Error(`Error en la paginación: ${error.message}`);
    }
  };
  
  export default paginate;
  