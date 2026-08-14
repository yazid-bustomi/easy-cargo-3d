const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

class AuthController {
  /**
   * POST /api/auth/login
   * Body: { email, password }
   */
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email dan password wajib diisi',
        });
      }

      // Cari user berdasarkan email (case-insensitive) dan aktif
      const user = await User.findOne({
        where: { email: String(email).trim().toLowerCase(), is_active: true },
      });

      if (!user) {
        // Jangan bocorkan apakah email ada atau tidak
        return res.status(401).json({ success: false, error: 'Email atau password salah' });
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);

      if (!isMatch) {
        return res.status(401).json({ success: false, error: 'Email atau password salah' });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      return res.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        },
      });
    } catch (error) {
      console.error('AuthController.login error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/auth/me
   * Butuh header: Authorization: Bearer <token>
   */
  static async me(req, res) {
    try {
      // req.user diisi oleh authMiddleware
      const user = await User.findByPk(req.user.id, {
        attributes: ['id', 'name', 'email', 'role', 'is_active'],
      });
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      res.json({ success: true, data: user });
    } catch (error) {
      console.error('AuthController.me error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = AuthController;