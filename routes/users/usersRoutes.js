// backend/routes/users/usersRoutes.js

/**
 * Rutas para "usersList"
 * - Se agregó GET /:id para obtener un usuario por id
 * - Se agregó PATCH /:id para permitir actualizaciones parciales (coincide con el frontend que usa PATCH)
 * - Se mantiene PUT /:id por compatibilidad
 */

import express from "express";
import {
  getUsers,
  getUserById,
  updateUser,
  createUser,
} from "../../controllers/Users/usersController.js";
import authMiddleware from "../../middleware/authMiddleware.js";

const router = express.Router();

// GET paginado | POST crear usuario
router.route("/").get(authMiddleware, getUsers).post(authMiddleware, createUser);

// GET por id, PUT y PATCH para actualizar
router
  .route("/:id")
  .get(authMiddleware, getUserById) // -> GET /api/usersList/:id
  .put(authMiddleware, updateUser) // -> PUT /api/usersList/:id (si lo usas)
  .patch(authMiddleware, updateUser); // -> PATCH /api/usersList/:id (soportado ahora)

export default router;
