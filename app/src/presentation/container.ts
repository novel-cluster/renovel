import {
  HomeQuery,
  RankingQuery,
  SearchNovelsQuery,
} from '@/application/queries/discovery/discovery.query'
import { SetNovelTagsService } from '@/application/services/discovery/set-novel-tags.service'
import { HealthService } from '@/application/services/health.service'
import { GetUserProfileService } from '@/application/services/identity/get-user-profile.service'
import { LoginService } from '@/application/services/identity/login.service'
import { LogoutService } from '@/application/services/identity/logout.service'
import { SignupService } from '@/application/services/identity/signup.service'
import { UpdateProfileService } from '@/application/services/identity/update-profile.service'
import {
  ListNotificationsService,
  UnreadNotificationCountService,
} from '@/application/services/notification/notification.service'
import { CreateNovelService } from '@/application/services/novel/create-novel.service'
import {
  GetNovelStudioService,
  ListStudioNovelsService,
} from '@/application/services/novel/studio-novels.query'
import { UpdateNovelService } from '@/application/services/novel/update-novel.service'
import {
  GetLibraryStateService,
  ListLibraryService,
  RemoveFromLibraryService,
  SetLibraryStateService,
} from '@/application/services/reading/library.service'
import { ReadNovelQuery } from '@/application/services/reading/read-novel.query'
import {
  RecordReadingProgressService,
  ResumeReadingService,
} from '@/application/services/reading/reading-progress.service'
import { EpisodeSocialQuery, NovelSocialQuery } from '@/application/services/social/social.query'
import {
  NotifyNovelUpdateService,
  PostCommentService,
  SetStarService,
  ToggleLikeService,
  ToggleNovelFollowService,
  ToggleUserFollowService,
  UpsertReviewService,
} from '@/application/services/social/social.service'
import { CreateEpisodeService } from '@/application/services/writing/create-episode.service'
import { GetEpisodeEditorService } from '@/application/services/writing/edit-episode.query'
import { PublishEpisodeService } from '@/application/services/writing/publish-episode.service'
import { SaveEpisodeService } from '@/application/services/writing/save-episode.service'
import { BunPasswordHasher } from '@/infrastructure/auth/bun-password-hasher'
import { DrizzleDiscoveryRepository } from '@/infrastructure/database/repositories/discovery.drizzle'
import { DrizzleEpisodeRepository } from '@/infrastructure/database/repositories/episode-repository.drizzle'
import { DrizzleEpisodeRevisionRepository } from '@/infrastructure/database/repositories/episode-revision-repository.drizzle'
import { DrizzleHealthRepository } from '@/infrastructure/database/repositories/health-repository.drizzle'
import { DrizzleLibraryRepository } from '@/infrastructure/database/repositories/library-repository.drizzle'
import { DrizzleNotificationRepository } from '@/infrastructure/database/repositories/notification.drizzle'
import { DrizzleNovelRepository } from '@/infrastructure/database/repositories/novel-repository.drizzle'
import { DrizzleReadingProgressRepository } from '@/infrastructure/database/repositories/reading-progress-repository.drizzle'
import { DrizzleSessionRepository } from '@/infrastructure/database/repositories/session-repository.drizzle'
import {
  DrizzleCommentRepository,
  DrizzleFollowRepository,
  DrizzleLikeRepository,
  DrizzleReviewRepository,
  DrizzleStarRepository,
} from '@/infrastructure/database/repositories/social.drizzle'
import { DrizzleTagRepository } from '@/infrastructure/database/repositories/tag.drizzle'
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
const readingProgressRepository = new DrizzleReadingProgressRepository()
const libraryRepository = new DrizzleLibraryRepository()
const likeRepository = new DrizzleLikeRepository()
const starRepository = new DrizzleStarRepository()
const reviewRepository = new DrizzleReviewRepository()
const commentRepository = new DrizzleCommentRepository()
const followRepository = new DrizzleFollowRepository()
const notificationRepository = new DrizzleNotificationRepository()
const discoveryRepository = new DrizzleDiscoveryRepository()
const tagRepository = new DrizzleTagRepository()
const rankingQuery = new RankingQuery(discoveryRepository)

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
  // reading (Phase 3)
  recordReadingProgressService: new RecordReadingProgressService(readingProgressRepository),
  resumeReadingService: new ResumeReadingService(readingProgressRepository),
  setLibraryStateService: new SetLibraryStateService(libraryRepository, novelRepository),
  removeFromLibraryService: new RemoveFromLibraryService(libraryRepository),
  getLibraryStateService: new GetLibraryStateService(libraryRepository),
  listLibraryService: new ListLibraryService(libraryRepository),
  // social & notification (Phase 4)
  followRepository,
  toggleLikeService: new ToggleLikeService(
    likeRepository,
    episodeRepository,
    novelRepository,
    notificationRepository,
  ),
  setStarService: new SetStarService(starRepository, novelRepository, notificationRepository),
  upsertReviewService: new UpsertReviewService(
    reviewRepository,
    novelRepository,
    notificationRepository,
  ),
  postCommentService: new PostCommentService(
    commentRepository,
    episodeRepository,
    novelRepository,
    readingProgressRepository,
    notificationRepository,
  ),
  toggleUserFollowService: new ToggleUserFollowService(followRepository, notificationRepository),
  toggleNovelFollowService: new ToggleNovelFollowService(
    followRepository,
    novelRepository,
    notificationRepository,
  ),
  notifyNovelUpdateService: new NotifyNovelUpdateService(
    followRepository,
    novelRepository,
    notificationRepository,
  ),
  episodeSocialQuery: new EpisodeSocialQuery(likeRepository, commentRepository),
  novelSocialQuery: new NovelSocialQuery(starRepository, reviewRepository, followRepository),
  listNotificationsService: new ListNotificationsService(notificationRepository),
  unreadNotificationCountService: new UnreadNotificationCountService(notificationRepository),
  // discovery (Phase 5)
  tagRepository,
  searchNovelsQuery: new SearchNovelsQuery(discoveryRepository),
  rankingQuery,
  homeQuery: new HomeQuery(discoveryRepository, rankingQuery),
  setNovelTagsService: new SetNovelTagsService(tagRepository, novelRepository),
} as const

export type Container = typeof container
