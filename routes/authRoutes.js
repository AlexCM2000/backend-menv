import express from "express"
import { register,verifyAccount,login,user,userAccount, forgotPassword, verifyPasswordResetToken, updatePassword, admin } from "../controllers/authController.js"
import authMiddleware from "../middleware/authMiddleware.js"

const router = express.Router()

router.post("/register",register)
router.get("/verify/:token", verifyAccount)
router.post("/login", login)
router.post("/forgot-password", forgotPassword)
router.route("/forgot-password/:token").get(verifyPasswordResetToken).post(updatePassword)



//area privada - requiere JWT 
router.get("/user",authMiddleware,user)
router.get("/user/:_id", authMiddleware, userAccount)
router.get("/admin",authMiddleware,admin)


export default router