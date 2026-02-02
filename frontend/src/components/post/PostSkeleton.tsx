'use client';

export function PostSkeleton() {
  return (
    <article className="card animate-fade-in">
      <div className="flex gap-4">
        {/* Vote Column Skeleton */}
        <div className="flex flex-col items-center gap-1">
          <div className="w-6 h-6 skeleton rounded" />
          <div className="w-4 h-5 skeleton rounded" />
          <div className="w-6 h-6 skeleton rounded" />
        </div>

        {/* Content Column Skeleton */}
        <div className="flex-1 min-w-0">
          {/* Meta skeleton */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-16 h-4 skeleton rounded" />
            <div className="w-2 h-2 skeleton rounded-full" />
            <div className="w-20 h-4 skeleton rounded" />
            <div className="w-2 h-2 skeleton rounded-full" />
            <div className="w-16 h-4 skeleton rounded" />
          </div>

          {/* Title skeleton */}
          <div className="w-3/4 h-6 skeleton rounded mb-2" />

          {/* Content skeleton */}
          <div className="space-y-2 mb-3">
            <div className="w-full h-4 skeleton rounded" />
            <div className="w-5/6 h-4 skeleton rounded" />
            <div className="w-2/3 h-4 skeleton rounded" />
          </div>

          {/* Actions skeleton */}
          <div className="flex items-center gap-4">
            <div className="w-24 h-4 skeleton rounded" />
            <div className="w-12 h-4 skeleton rounded" />
            <div className="w-14 h-4 skeleton rounded" />
            <div className="w-12 h-4 skeleton rounded" />
          </div>
        </div>
      </div>
    </article>
  );
}

export function PostSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <PostSkeleton key={i} />
      ))}
    </div>
  );
}
