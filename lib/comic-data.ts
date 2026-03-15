export interface ComicPage {
  id: number
  image: string
  video?: string
  title?: string
  interactiveElements?: InteractiveElement[]
}

export interface InteractiveElement {
  id: string
  type: 'hotspot' | 'tooltip' | 'reveal'
  x: number
  y: number
  width: number
  height: number
  content: string
  action?: 'play-sound' | 'show-info' | 'zoom'
}

export interface Comic {
  id: string
  title: string
  author: string
  coverImage: string
  volume?: string
  episode?: string
  pages: ComicPage[]
}

export const sampleComic: Comic = {
  id: 'night-guardian',
  title: 'Night Guardian',
  author: 'Comic Studio',
  coverImage: '/comic/page-1.jpg',
  pages: [
    {
      id: 1,
      image: '/comic/page-1.jpg',
      title: 'The Beginning',
      interactiveElements: [
        {
          id: 'hero-intro',
          type: 'tooltip',
          x: 45,
          y: 30,
          width: 20,
          height: 25,
          content: 'Meet the Night Guardian - protector of the city',
          action: 'show-info'
        }
      ]
    },
    {
      id: 2,
      image: '/comic/page-2.jpg',
      title: 'The Landing',
      interactiveElements: [
        {
          id: 'villain-shadow',
          type: 'hotspot',
          x: 70,
          y: 20,
          width: 15,
          height: 20,
          content: 'A mysterious figure watches from the shadows...',
          action: 'show-info'
        }
      ]
    },
    {
      id: 3,
      image: '/comic/page-3.jpg',
      title: 'The Confrontation',
      interactiveElements: [
        {
          id: 'tension',
          type: 'reveal',
          x: 30,
          y: 40,
          width: 40,
          height: 30,
          content: 'The tension builds as hero and villain face off',
          action: 'show-info'
        }
      ]
    },
    {
      id: 4,
      image: '/comic/page-4.jpg',
      title: 'The Battle',
      interactiveElements: [
        {
          id: 'action',
          type: 'hotspot',
          x: 50,
          y: 35,
          width: 30,
          height: 35,
          content: 'POW! An epic battle ensues!',
          action: 'play-sound'
        }
      ]
    },
    {
      id: 5,
      image: '/comic/page-5.jpg',
      title: 'Victory',
      interactiveElements: []
    },
    {
      id: 6,
      image: '/comic/page-6.jpg',
      title: 'The Guardian Watches',
      interactiveElements: [
        {
          id: 'ending',
          type: 'tooltip',
          x: 40,
          y: 25,
          width: 25,
          height: 30,
          content: 'The city is safe... for now.',
          action: 'show-info'
        }
      ]
    }
  ]
}
