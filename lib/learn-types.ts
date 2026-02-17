export interface LearnTopic {
  id: string
  title: string
  description: string
  section: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  readTime: string
  icon: string
  tags: string[]
}

export interface LearnProgress {
  topicId: string
  status: 'unread' | 'read' | 'quizzed' | 'mastered'
  quizScore?: number
  readAt?: string
  quizzedAt?: string
}

export interface QuizQuestion {
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export interface TopicContent {
  topic: LearnTopic
  content: string
  quiz: QuizQuestion[]
}
