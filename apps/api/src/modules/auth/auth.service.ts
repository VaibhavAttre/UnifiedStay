import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { db } from '@unifiedstay/database';
import type { LoginInput, RegisterInput } from '@unifiedstay/shared';

class AuthService {
  async register(input: RegisterInput, fastify: FastifyInstance) {
    // Check if user exists
    const existingUser = await db.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, 12);

    // Create user
    const user = await db.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    // Generate token
    const accessToken = fastify.jwt.sign({ id: user.id, email: user.email });

    return {
      user,
      accessToken,
    };
  }

  async login(input: LoginInput, fastify: FastifyInstance) {
    // Find user
    const user = await db.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(input.password, user.passwordHash);

    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Generate token
    const accessToken = fastify.jwt.sign({ id: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      accessToken,
    };
  }

  async getCurrentUser(userId: string) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }
}

export const authService = new AuthService();

