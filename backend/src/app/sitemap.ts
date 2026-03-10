import { getAllTagSlugs } from '@/actions/tags/get-tags';
import { getAllToolSlugs, getTools } from '@/actions/tools/get-tools';
import { websiteConfig } from '@/config/website';
import { getLocalePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { blogSource, categorySource } from '@/lib/source';
import type { MetadataRoute } from 'next';
import type { Locale } from 'next-intl';
import { getBaseUrl } from '../lib/urls/urls';

type Href = Parameters<typeof getLocalePathname>[0]['href'];

const TOOLS_PER_PAGE = 20;

const staticRoutes = [
  '/',
  '/pricing',
  '/about',
  '/waitlist',
  '/changelog',
  '/privacy',
  '/terms',
  '/cookie',
  '/tools',
  '/tools/submit',
  '/tags',
  ...(websiteConfig.blog.enable ? ['/blog'] : []),
];

/**
 * Generate a sitemap with hreflang alternates for all locales.
 *
 * @see https://nextjs.org/docs/app/api-reference/functions/generate-sitemaps
 * @see https://next-intl.dev/docs/environments/actions-metadata-route-handlers#sitemap
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sitemapList: MetadataRoute.Sitemap = [];

  // Static routes
  for (const route of staticRoutes) {
    sitemapList.push(
      ...getEntries(route, { priority: 1, changeFrequency: 'weekly' })
    );
  }

  // Tool detail pages
  try {
    const toolSlugs = await getAllToolSlugs();
    for (const slug of toolSlugs) {
      sitemapList.push(
        ...getEntries(`/tools/${slug}`, {
          priority: 0.8,
          changeFrequency: 'weekly',
        })
      );
    }
  } catch {
    // DB may be unavailable during build; skip tool routes
  }

  // Tag detail pages
  try {
    const tagSlugs = await getAllTagSlugs();
    for (const slug of tagSlugs) {
      sitemapList.push(
        ...getEntries(`/tags/${slug}`, {
          priority: 0.7,
          changeFrequency: 'weekly',
        })
      );
    }
  } catch {
    // DB may be unavailable during build; skip tag routes
  }

  // Tools list pagination (page 2+)
  try {
    const { total } = await getTools({
      locale: routing.defaultLocale,
      page: 1,
      pageSize: 1,
      published: true,
    });
    const totalPages = Math.ceil(total / TOOLS_PER_PAGE);
    for (let page = 2; page <= totalPages; page++) {
      sitemapList.push(
        ...getEntries(`/tools/page/${page}`, {
          priority: 0.6,
          changeFrequency: 'weekly',
        })
      );
    }
  } catch {
    // DB may be unavailable during build; skip tools pagination
  }

  // Blog routes
  if (websiteConfig.blog.enable) {
    // Categories
    for (const category of categorySource.getPages()) {
      sitemapList.push(
        ...getEntries(`/blog/category/${category.slugs[0]}`, {
          priority: 0.8,
          changeFrequency: 'weekly',
        })
      );
    }

    // Paginated blog list pages (per locale, not shared across locales)
    for (const locale of routing.locales) {
      const posts = blogSource
        .getPages(locale)
        .filter((post) => post.data.published);
      const totalPages = Math.max(
        1,
        Math.ceil(posts.length / websiteConfig.blog.paginationSize)
      );
      for (let page = 2; page <= totalPages; page++) {
        sitemapList.push(
          ...getEntries(`/blog/page/${page}`, {
            priority: 0.6,
            changeFrequency: 'weekly',
          })
        );
      }
    }

    // Paginated category pages
    for (const locale of routing.locales) {
      for (const category of categorySource.getPages(locale)) {
        const postsInCategory = blogSource
          .getPages(locale)
          .filter(
            (post) =>
              post.data.published &&
              post.data.categories.some((cat) => cat === category.slugs[0])
          );
        const totalPages = Math.max(
          1,
          Math.ceil(postsInCategory.length / websiteConfig.blog.paginationSize)
        );
        for (let page = 2; page <= totalPages; page++) {
          sitemapList.push(
            ...getEntries(`/blog/category/${category.slugs[0]}/page/${page}`, {
              priority: 0.6,
              changeFrequency: 'weekly',
            })
          );
        }
      }
    }

    // Individual blog posts
    for (const post of blogSource.getPages()) {
      if (!post.data.published) continue;
      const lastModified = post.data.date
        ? new Date(post.data.date)
        : new Date();
      sitemapList.push(
        ...getEntries(`/blog/${post.slugs.join('/')}`, {
          priority: 0.8,
          changeFrequency: 'weekly',
          lastModified,
        })
      );
    }
  }

  return sitemapList;
}

function getUrl(href: Href, locale: Locale) {
  const pathname = getLocalePathname({ locale, href });
  return getBaseUrl() + pathname;
}

function getEntries(
  href: Href,
  opts?: {
    priority?: number;
    changeFrequency?: MetadataRoute.Sitemap[number]['changeFrequency'];
    lastModified?: Date;
  }
) {
  const languages = Object.fromEntries(
    routing.locales.map((loc) => [loc, getUrl(href, loc)])
  );

  return routing.locales.map((locale) => ({
    url: getUrl(href, locale),
    lastModified: opts?.lastModified ?? new Date(),
    priority: opts?.priority ?? 0.8,
    changeFrequency: opts?.changeFrequency ?? ('weekly' as const),
    alternates: { languages },
  }));
}
