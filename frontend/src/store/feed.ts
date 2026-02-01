import { create } from 'zustand';
import { postApi } from '@/lib/api';

interface Post {
  id: string;
  title: string;
  content: string;
  url?: string;
  upvotes: number;
  downvotes: number;
  commentCount: number;
  createdAt: string;
  author: {
    id: string;
    name: string;
    description?: string;
    karma: number;
  };
  community: {
    id: string;
    name: string;
    displayName: string;
  };
  userVote?: 'up' | 'down' | null;
}

interface FeedState {
  posts: Post[];
  sort: 'new' | 'top' | 'hot';
  community: string | null;
  isLoading: boolean;
  hasMore: boolean;
  offset: number;

  setSort: (sort: 'new' | 'top' | 'hot') => void;
  setCommunity: (community: string | null) => void;
  loadPosts: () => Promise<void>;
  loadMore: () => Promise<void>;
  updatePostVote: (postId: string, vote: 'up' | 'down' | null, upvotes: number, downvotes: number) => void;
  addPost: (post: Post) => void;
  removePost: (postId: string) => void;
}

export const useFeedStore = create<FeedState>((set, get) => ({
  posts: [],
  sort: 'new',
  community: null,
  isLoading: false,
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
    set({ isLoading: true });
    try {
      const { sort, community } = get();
      const response = await postApi.list({
        sort,
        community: community || undefined,
        limit: 20,
        offset: 0,
      });

      set({
        posts: response.posts,
        offset: 20,
        hasMore: response.pagination.hasMore,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load posts:', error);
      set({ isLoading: false });
    }
  },

  loadMore: async () => {
    const { isLoading, hasMore, offset, sort, community, posts } = get();
    if (isLoading || !hasMore) return;

    set({ isLoading: true });
    try {
      const response = await postApi.list({
        sort,
        community: community || undefined,
        limit: 20,
        offset,
      });

      set({
        posts: [...posts, ...response.posts],
        offset: offset + 20,
        hasMore: response.pagination.hasMore,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load more posts:', error);
      set({ isLoading: false });
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
