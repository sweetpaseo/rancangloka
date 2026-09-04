/**
 * RancangLoka Standard Application & Database Error Semantics
 * Phase 1A / 1B Foundation
 */

export type ErrorCode =
  | 'DUPLICATE_SLUG'
  | 'DUPLICATE_CONTENT'
  | 'DATABASE_WRITE_FAILED'
  | 'DATABASE_CONSTRAINT_FAILED'
  | 'ARTICLE_NOT_FOUND'
  | 'CATEGORY_NOT_FOUND'
  | 'AUTHOR_NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'FRONTMATTER_INVALID'
  | 'UNSAFE_MARKDOWN';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly originalError?: any;

  constructor(code: ErrorCode, message: string, statusCode = 500, originalError?: any) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.originalError = originalError;
  }
}

export class DuplicateSlugError extends AppError {
  constructor(message = 'Slug artikel sudah terdaftar di database', originalError?: any) {
    super('DUPLICATE_SLUG', message, 409, originalError);
    this.name = 'DuplicateSlugError';
  }
}

export class DuplicateContentError extends AppError {
  constructor(message = 'Konten artikel sama persis dengan yang sudah ada (duplicate content hash)', originalError?: any) {
    super('DUPLICATE_CONTENT', message, 409, originalError);
    this.name = 'DuplicateContentError';
  }
}

export class DatabaseWriteError extends AppError {
  constructor(message = 'Gagal melakukan penulisan data ke Cloudflare D1', originalError?: any) {
    super('DATABASE_WRITE_FAILED', message, 500, originalError);
    this.name = 'DatabaseWriteError';
  }
}

export class DatabaseConstraintError extends AppError {
  constructor(message = 'Pelanggaran constraint database D1', originalError?: any) {
    super('DATABASE_CONSTRAINT_FAILED', message, 409, originalError);
    this.name = 'DatabaseConstraintError';
  }
}

export class ArticleNotFoundError extends AppError {
  constructor(message = 'Artikel tidak ditemukan', originalError?: any) {
    super('ARTICLE_NOT_FOUND', message, 404, originalError);
    this.name = 'ArticleNotFoundError';
  }
}

export class CategoryNotFoundError extends AppError {
  constructor(message = 'Kategori tidak valid atau tidak terdaftar', originalError?: any) {
    super('CATEGORY_NOT_FOUND', message, 400, originalError);
    this.name = 'CategoryNotFoundError';
  }
}

export class AuthorNotFoundError extends AppError {
  constructor(message = 'Penulis tidak valid atau tidak terdaftar', originalError?: any) {
    super('AUTHOR_NOT_FOUND', message, 400, originalError);
    this.name = 'AuthorNotFoundError';
  }
}

export class ValidationError extends AppError {
  public readonly validationErrors: string[];

  constructor(message = 'Validasi artikel gagal', validationErrors: string[] = [], originalError?: any) {
    super('VALIDATION_FAILED', message, 400, originalError);
    this.name = 'ValidationError';
    this.validationErrors = validationErrors;
  }
}

export class FrontmatterError extends AppError {
  constructor(message = 'Format frontmatter YAML tidak valid', originalError?: any) {
    super('FRONTMATTER_INVALID', message, 400, originalError);
    this.name = 'FrontmatterError';
  }
}

export class UnsafeMarkdownError extends AppError {
  constructor(message = 'Artikel mengandung elemen HTML/skrip berbahaya yang tidak diizinkan', originalError?: any) {
    super('UNSAFE_MARKDOWN', message, 400, originalError);
    this.name = 'UnsafeMarkdownError';
  }
}
