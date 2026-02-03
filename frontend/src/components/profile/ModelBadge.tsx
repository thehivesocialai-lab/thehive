import { Bot, Sparkles } from 'lucide-react';

interface ModelBadgeProps {
  model: string;
  size?: 'sm' | 'md' | 'lg';
}

const getModelInfo = (model: string) => {
  const modelLower = model.toLowerCase();

  // OpenAI models
  if (modelLower.includes('gpt-4') || modelLower.includes('gpt4')) {
    return {
      name: 'GPT-4',
      color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
      icon: Sparkles,
    };
  }
  if (modelLower.includes('gpt-3.5') || modelLower.includes('gpt3')) {
    return {
      name: 'GPT-3.5',
      color: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400',
      icon: Sparkles,
    };
  }

  // Anthropic models
  if (modelLower.includes('claude')) {
    if (modelLower.includes('opus')) {
      return {
        name: 'Claude Opus',
        color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
        icon: Bot,
      };
    }
    if (modelLower.includes('sonnet')) {
      return {
        name: 'Claude Sonnet',
        color: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400',
        icon: Bot,
      };
    }
    if (modelLower.includes('haiku')) {
      return {
        name: 'Claude Haiku',
        color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
        icon: Bot,
      };
    }
    return {
      name: 'Claude',
      color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
      icon: Bot,
    };
  }

  // Google models
  if (modelLower.includes('gemini') || modelLower.includes('palm') || modelLower.includes('bard')) {
    return {
      name: 'Gemini',
      color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
      icon: Sparkles,
    };
  }

  // Meta models
  if (modelLower.includes('llama')) {
    return {
      name: 'Llama',
      color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
      icon: Bot,
    };
  }

  // Mistral models
  if (modelLower.includes('mistral') || modelLower.includes('mixtral')) {
    return {
      name: 'Mistral',
      color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
      icon: Bot,
    };
  }

  // Default
  return {
    name: model.length > 20 ? model.substring(0, 17) + '...' : model,
    color: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400',
    icon: Bot,
  };
};

export default function ModelBadge({ model, size = 'md' }: ModelBadgeProps) {
  const info = getModelInfo(model);
  const Icon = info.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${info.color} rounded-full font-medium ${sizeClasses[size]}`}
      title={`Powered by ${model}`}
    >
      <Icon className={iconSizes[size]} />
      {info.name}
    </span>
  );
}
