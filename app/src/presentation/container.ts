import { HealthService } from '@/application/services/health.service'
import { GetUserProfileService } from '@/application/services/identity/get-user-profile.service'
import { LoginService } from '@/application/services/identity/login.service'
import { LogoutService } from '@/application/services/identity/logout.service'
import { SignupService } from '@/application/services/identity/signup.service'
import { UpdateProfileService } from '@/application/services/identity/update-profile.service'
import { CreateNovelService } from '@/application/services/novel/create-novel.service'
import {
  GetNovelStudioService,
  ListStudioNovelsService,
} from '@/application/services/novel/studio-novels.query'
import { UpdateNovelService } from '@/application/services/novel/update-novel.service'
import { ReadNovelQuery } from '@/application/services/reading/read-novel.query'
import { CreateEpisodeService } from '@/application/services/writing/create-episode.service'
import { GetEpisodeEditorService } from '@/application/services/writing/edit-episode.query'
import { PublishEpisodeService } from '@/application/services/writing/publish-episode.service'
import { SaveEpisodeService } from '@/application/services/writing/save-episode.service'
import { BunPasswordHasher } from '@/infrastructure/auth/bun-password-hasher'
import { DrizzleEpisodeRepository } from '@/infrastructure/database/repositories/episode-repository.drizzle'
import { DrizzleEpisodeRevisionRepository } from '@/infrastructure/database/repositories/episode-revision-repository.drizzle'
import { DrizzleHealthRepository } from '@/infrastructure/database/repositories/health-repository.drizzle'
import { DrizzleNovelRepository } from '@/infrastructure/database/repositories/novel-repository.drizzle'
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
const novelRepository = new DrizzleNovelRepository()
const episodeRepository = new DrizzleEpisodeRepository()
const episodeRevisionRepository = new DrizzleEpisodeRevisionRepository()

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
  // novel & writing (Phase 2)
  novelRepository,
  episodeRepository,
  createNovelService: new CreateNovelService(novelRepository),
  updateNovelService: new UpdateNovelService(novelRepository),
  listStudioNovelsService: new ListStudioNovelsService(novelRepository),
  getNovelStudioService: new GetNovelStudioService(novelRepository, episodeRepository),
  createEpisodeService: new CreateEpisodeService(novelRepository, episodeRepository),
  saveEpisodeService: new SaveEpisodeService(
    novelRepository,
    episodeRepository,
    episodeRevisionRepository,
  ),
  publishEpisodeService: new PublishEpisodeService(
    novelRepository,
    episodeRepository,
    episodeRevisionRepository,
  ),
  getEpisodeEditorService: new GetEpisodeEditorService(novelRepository, episodeRepository),
  readNovelQuery: new ReadNovelQuery(novelRepository, episodeRepository, userRepository),
} as const

export type Container = typeof container
