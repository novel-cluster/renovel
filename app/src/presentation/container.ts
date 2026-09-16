import { HealthService } from '@/application/services/health.service'
import { GetUserProfileService } from '@/application/services/identity/get-user-profile.service'
import { LoginService } from '@/application/services/identity/login.service'
import { LogoutService } from '@/application/services/identity/logout.service'
import { SignupService } from '@/application/services/identity/signup.service'
import { UpdateProfileService } from '@/application/services/identity/update-profile.service'
import { BunPasswordHasher } from '@/infrastructure/auth/bun-password-hasher'
import { DrizzleHealthRepository } from '@/infrastructure/database/repositories/health-repository.drizzle'
import { DrizzleSessionRepository } from '@/infrastructure/database/repositories/session-repository.drizzle'
import { DrizzleUserRepository } from '@/infrastructure/database/repositories/user-repository.drizzle'

/**
 * Composition root.
 *
 * The single place where concrete infrastructure is wired into application
 * services. Controllers import ready-made services from here instead of
 * `new`-ing repositories themselves, keeping the dependency direction clean.
 * Phase 0 uses plain manual wiring; introduce a DI container only if this grows.
 */
const userRepository = new DrizzleUserRepository()
const sessionRepository = new DrizzleSessionRepository()
const passwordHasher = new BunPasswordHasher()

export const container = {
  healthService: new HealthService(new DrizzleHealthRepository()),
  // identity (Phase 1)
  userRepository,
  sessionRepository,
  signupService: new SignupService(userRepository, sessionRepository, passwordHasher),
  loginService: new LoginService(userRepository, sessionRepository, passwordHasher),
  logoutService: new LogoutService(sessionRepository),
  getUserProfileService: new GetUserProfileService(userRepository),
  updateProfileService: new UpdateProfileService(userRepository),
} as const

export type Container = typeof container
