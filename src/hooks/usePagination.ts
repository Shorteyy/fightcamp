import { useEffect, useState } from 'react';

export const PAGE_SIZE = 15;

export function usePagination<T>(items: T[], pageSize: number = PAGE_SIZE) {
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [items.length]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const clampedPage = Math.min(page, totalPages - 1);
  const pageItems = items.slice(clampedPage * pageSize, clampedPage * pageSize + pageSize);

  return { pageItems, page: clampedPage, totalPages, setPage };
}
