import type { Novel } from '@/domain/novel/entities/novel'
import type { NovelRepository } from '@/domain/novel/repositories/novel-repository'
import { NovelSlug } from '@/domain/novel/value-objects/novel-slug'
import { ValidationError } from '@/shared/errors/app-error'

export interface CreateNovelInput {
  authorId: string
  title: string
}

/** Create a Novel (PRD §7). Starts Private; a unique random slug is generated. */
export class CreateNovelService {
  constructor(private readonly novels: NovelRepository) {}

  async execute(input: CreateNovelInput): Promise<Novel> {
    const title = input.title.trim()
    if (!title) throw new ValidationError('タイトルを入力してください')
    if (title.length > 200) throw new ValidationError('タイトルは200文字以内で入力してください')

    let slug = NovelSlug.generate()
    for (let i = 0; i < 5 && (await this.novels.slugExists(slug)); i++) {
      slug = NovelSlug.generate()
    }

    return this.novels.create({ slug, authorId: input.authorId, title })
  }
}
