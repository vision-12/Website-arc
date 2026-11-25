import 'server-only';
import { renderRichText } from '@/lib/rich-text/render';
import type { ImageRef, SectionData } from '../../types';
import { publicObjectUrl } from '../loaders/media';
import type { HomeSectionType } from '../section-settings';
import { DEMO_MEDIA, type DemoMediaKey } from './media';

/**
 * Typed demo content for every section type (P3-C). Used only by the demo gallery and tests, never
 * by the real homepage: modules whose tables arrive later (news, events, gallery, academics, staff)
 * show here first. Dates are fixed so screenshots are stable.
 */

function image(key: DemoMediaKey): ImageRef {
  const media = DEMO_MEDIA[key];
  return {
    src: publicObjectUrl('media', media.path),
    width: media.width,
    height: media.height,
    alt: media.alt,
    lqip: media.lqip,
  };
}

const paragraphs = (...texts: string[]) =>
  renderRichText({
    type: 'doc',
    content: texts.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
  });

export function demoSectionData(): { [K in HomeSectionType]: SectionData[K] } {
  return {
    hero: {
      autoplaySeconds: 7,
      slides: [
        {
          image: image('hero-main'),
          heading: 'Day and boarding secondary school in Ntinda, Kampala',
          subheading: 'O-level and A-level for 1,150 students, with boarding from senior one.',
          cta: { label: 'Book a school visit', href: '/admissions/visits', external: false },
        },
        {
          image: image('hero-library'),
          heading: 'A library open until 9 pm for boarders',
          subheading:
            'Supervised prep runs every weekday evening, with a teacher on duty in each block.',
        },
        {
          image: image('hero-sport'),
          heading: 'Sport every afternoon on two fields and four courts',
          subheading:
            'Football, netball, athletics and volleyball, with inter-house competitions each term.',
        },
      ],
    },
    quickInfo: {
      items: [
        { icon: 'calendar', label: 'Term one begins', value: '2 February 2027' },
        { icon: 'graduation-cap', label: 'Curriculum', value: 'UNEB O-level and A-level' },
        { icon: 'users', label: 'Students', value: '1,150 day and boarding' },
        { icon: 'clock', label: 'School day', value: '7:30 am to 4:30 pm' },
      ],
    },
    introduction: {
      heading: 'About the school',
      body: paragraphs(
        'Demo School is a mixed day and boarding secondary school in Ntinda, founded in 1964. Students sit UNEB examinations at senior four and senior six.',
        'Classes have at most 45 students, and every student has a form tutor who stays with the class from senior one to senior four.',
      ),
      image: image('intro'),
      cta: { label: "Read the school's history", href: '/about/history', external: false },
    },
    academicOverview: {
      heading: 'Academics',
      intro:
        'Eighteen O-level subjects and twelve A-level combinations, taught in streams of up to 45.',
      viewAllHref: '/academics',
      levels: [
        {
          name: 'Senior one to four',
          href: '/academics/o-level',
          summary:
            'The UNEB O-level curriculum: eight compulsory subjects and up to two electives.',
          image: image('level-o'),
        },
        {
          name: 'Senior five and six',
          href: '/academics/a-level',
          summary:
            'Sciences, arts and business combinations, with General Paper for every student.',
          image: image('level-a'),
        },
        {
          name: 'Library and private study',
          href: '/academics/library',
          summary: '14,000 books, open to boarders until 9 pm on weekdays.',
          image: image('level-library'),
        },
      ],
    },
    latestNews: {
      heading: 'News from the school',
      viewAllHref: '/news',
      articles: [
        {
          title: 'Athletics team wins four medals at the district championships',
          href: '/news/district-athletics-2026',
          excerpt: 'Senior four student Brian Okello took gold in the 1,500 metres.',
          publishedAt: '2026-11-18T09:00:00Z',
          category: 'Sport',
          image: image('news-1'),
        },
        {
          title: 'Science fair projects on clean water and solar drying',
          href: '/news/science-fair-2026',
          excerpt:
            'Twenty-two teams presented their work to parents and judges from three schools.',
          publishedAt: '2026-11-04T09:00:00Z',
          category: 'Academics',
          image: image('news-2'),
        },
        {
          title: 'Open day brings 600 families to the school',
          href: '/news/open-day-2026',
          excerpt:
            'Prospective students visited classes, the laboratories and the boarding houses.',
          publishedAt: '2026-10-21T09:00:00Z',
          category: 'Admissions',
          image: image('news-3'),
        },
      ],
    },
    statistics: {
      heading: 'The school in numbers',
      items: [
        { value: '1964', label: 'Year the school opened' },
        { value: '1,150', label: 'Students from senior one to six' },
        { value: '45', label: 'Students per class at most' },
        { value: '38', label: 'Clubs and societies' },
      ],
    },
    leadershipMessage: {
      heading: 'A message from the head teacher',
      person: { name: 'Margaret Nansubuga', role: 'Head teacher', image: image('head-teacher') },
      message: paragraphs(
        'Families choose a school for its teachers. Ours know every student by name, and they meet parents every term to go through each report in person.',
      ),
    },
    upcomingEvents: {
      heading: 'Coming up',
      viewAllHref: '/events',
      events: [
        {
          title: 'Senior six graduation',
          href: '/events/graduation-2026',
          startsAt: '2026-12-05T07:00:00Z',
          allDay: false,
          venue: 'Main hall',
        },
        {
          title: 'Term one begins',
          href: '/events/term-one-2027',
          startsAt: '2027-02-02T05:00:00Z',
          allDay: true,
        },
        {
          title: 'Parents’ meeting, senior one',
          href: '/events/parents-meeting-s1-2027',
          startsAt: '2027-02-20T06:00:00Z',
          allDay: false,
          venue: 'Library',
        },
      ],
    },
    galleryPreview: {
      heading: 'School life',
      viewAllHref: '/gallery',
      images: [
        image('gallery-1'),
        image('gallery-2'),
        image('gallery-3'),
        image('gallery-4'),
        image('gallery-5'),
      ],
    },
    testimonials: {
      heading: 'Parents and former students',
      items: [
        {
          quote:
            'Our daughter boards from Monday to Friday. Prep is supervised, so her homework is done before she comes home at the weekend.',
          name: 'Grace Nakato',
          role: 'Parent of a senior three student',
          image: image('parent-1'),
        },
        {
          quote:
            'Within a week the form tutor saw that our son was behind in chemistry and arranged extra practical sessions.',
          name: 'Daniel Ssempala',
          role: 'Parent of a senior five student',
          image: image('parent-2'),
        },
        {
          quote:
            'I joined in senior one and left after senior six for university. The debating club is where I learnt to speak in public.',
          name: 'Agnes Akello',
          role: 'Former student, class of 2019',
          image: image('parent-3'),
        },
      ],
    },
    customRichText: {
      heading: 'Getting here',
      body: paragraphs(
        'The school is on Kiwatule Road in Ntinda, ten minutes from Ntinda shopping centre. School buses run each morning from Kireka, Naalya and Bukoto.',
      ),
      layout: 'narrow',
    },
    admissionsCta: {
      heading: 'Admissions for 2027',
      body: 'Applications for senior one and senior five open in October. Tours of the school run every Saturday at 10 am.',
      openIntake: {
        name: 'Senior one, 2027',
        href: '/admissions/apply/s1-2027',
        closesAt: '2026-12-12T18:00:00Z',
      },
      cta: { label: 'Start an application', href: '/admissions/apply/s1-2027', external: false },
    },
  };
}
