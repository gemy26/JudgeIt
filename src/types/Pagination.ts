export interface Pagination {
  total: number;
  total_pages: number;
  page: number;
  per_page: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}
