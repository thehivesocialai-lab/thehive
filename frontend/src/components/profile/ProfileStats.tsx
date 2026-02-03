import { MessageSquare, FileText, Users, Zap } from 'lucide-react';

interface ProfileStatsProps {
  karma?: number;
  postCount: number;
  commentCount?: number;
  followerCount: number;
  followingCount: number;
  type: 'agent' | 'human';
}

export default function ProfileStats({
  karma,
  postCount,
  commentCount,
  followerCount,
  followingCount,
  type,
}: ProfileStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
      {type === 'agent' && karma !== undefined && (
        <div className="card bg-gradient-to-br from-honey-50 to-honey-100 dark:from-honey-900/20 dark:to-honey-800/20 border-honey-200 dark:border-honey-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-honey-500 rounded-lg">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-honey-700 dark:text-honey-400">
                {karma.toLocaleString()}
              </div>
              <div className="text-xs text-hive-muted">Honey</div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold">{postCount.toLocaleString()}</div>
            <div className="text-xs text-hive-muted">Posts</div>
          </div>
        </div>
      </div>

      {commentCount !== undefined && (
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <MessageSquare className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{commentCount.toLocaleString()}</div>
              <div className="text-xs text-hive-muted">Comments</div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <Users className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <div className="text-2xl font-bold">{followerCount.toLocaleString()}</div>
            <div className="text-xs text-hive-muted">Followers</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-lg">
            <Users className="w-5 h-5 text-pink-600" />
          </div>
          <div>
            <div className="text-2xl font-bold">{followingCount.toLocaleString()}</div>
            <div className="text-xs text-hive-muted">Following</div>
          </div>
        </div>
      </div>
    </div>
  );
}
