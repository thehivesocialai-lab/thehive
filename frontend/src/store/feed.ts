import { create } from 'zustand';
import { postApi } from '@/lib/api';

type SortOption = 'new' | 'top' | 'hot' | 'rising' | 'controversial';

export interface Post {
  id: string;
  title?: string | null;
  content: string;
  url?: string;
  imageUrl?: string | null;
  upvotes: number;
  downvotes: number;
  commentCount: number;
  createdAt: string;
  author: {
    id: string;
    name: string;
    description?: string;
    displayName?: string;
    karma?: number;
    type?: 'agent' | 'human';
  };
  community?: {
    id: string;
    name: string;
    displayName: string;
  } | null;
  userVote?: 'up' | 'down' | null;
  isBookmarked?: boolean;
  poll?: any;
}

interface FeedState {
  posts: Post[];
  sort: SortOption;
  community: string | null;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  offset: number;

  setSort: (sort: SortOption) => void;
  setCommunity: (community: string | null) => void;
  loadPosts: () => Promise<void>;
  loadMore: () => Promise<void>;
  retry: () => Promise<void>;
  updatePostVote: (postId: string, vote: 'up' | 'down' | null, upvotes: number, downvotes: number) => void;
  addPost: (post: Post) => void;
  removePost: (postId: string) => void;
}

const LOADING_TIMEOUT = 15000; // 15 seconds

// Helper function to create a timeout promise
const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out')), timeoutMs)
    ),
  ]);
};

export const useFeedStore = create<FeedState>((set, get) => ({
  posts: [],
  sort: 'new',
  community: null,
  isLoading: false,
  error: null,
  hasMore: true,
  offset: 0,

  setSort: (sort) => {
    set({ sort, posts: [], offset: 0, hasMore: true });
    get().loadPosts();
  },

  setCommunity: (community) => {
    set({ community, posts: [], offset: 0, hasMore: true });
    get().loadPosts();
  },

  loadPosts: async () => {
    set({ isLoading: true, error: null });
    try {
      const { sort, community } = get();
      const response = await withTimeout(
        postApi.list({
          sort,
          community: community || undefined,
          limit: 20,
          offset: 0,
        }),
        LOADING_TIMEOUT
      );

      set({
        posts: response.posts,
        offset: 20,
        hasMore: response.pagination.hasMore,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Failed to load posts:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load posts';
      set({
        isLoading: false,
        error: errorMessage,
      });
    }
  },

  loadMore: async () => {
    const { isLoading, hasMore, offset, sort, community, posts } = get();
    if (isLoading || !hasMore) return;

    set({ isLoading: true, error: null });
    try {
      const response = await withTimeout(
        postApi.list({
          sort,
          community: community || undefined,
          limit: 20,
          offset,
        }),
        LOADING_TIMEOUT
      );

      set({
        posts: [...posts, ...response.posts],
        offset: offset + 20,
        hasMore: response.pagination.hasMore,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Failed to load more posts:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load more posts';
      set({
        isLoading: false,
        error: errorMessage,
      });
    }
  },

  retry: async () => {
    const { posts } = get();
    if (posts.length === 0) {
      // Initial load failed, retry from beginning
      await get().loadPosts();
    } else {
      // Loading more failed, retry loading more
      await get().loadMore();
    }
  },

  updatePostVote: (postId, vote, upvotes, downvotes) => {
    set((state) => ({
      posts: state.posts.map((post) =>
        post.id === postId ? { ...post, userVote: vote, upvotes, downvotes } : post
      ),
    }));
  },

  addPost: (post) => {
    set((state) => ({ posts: [post, ...state.posts] }));
  },

  removePost: (postId) => {
    set((state) => ({
      posts: state.posts.filter((post) => post.id !== postId),
    }));
  },
}));
