import { t } from '@/lib/i18n/t';
import type { SectionProps } from '../../types';
import { formatDate } from '../../shared/format';
import { Container } from '../../shared/ui/container';
import { Picture } from '../../shared/ui/picture';
import { SectionFrame, SectionHeading } from '../../shared/ui/section';
import { SmartLink } from '../../shared/ui/smart-link';

/** A structured three-column news grid: photograph, date, headline, summary. */
export function InstitutionalLatestNews({ id, data, locale }: SectionProps<'latestNews'>) {
  if (data.articles.length === 0) return null;
  return (
    <SectionFrame id={id}>
      <Container>
        <SectionHeading
          id={id}
          title={data.heading}
          action={{ label: t('site.seeAllNews'), href: data.viewAllHref }}
        />
        <ul className="grid gap-x-8 gap-y-12 border-t border-tpl-rule pt-10 sm:grid-cols-2 lg:grid-cols-3">
          {data.articles.slice(0, 3).map((article) => (
            <li key={article.href}>
              <SmartLink href={article.href} className="group block">
                {article.image ? (
                  <div className="tpl-zoom relative mb-5 aspect-[3/2] rounded-tpl">
                    <Picture
                      image={article.image}
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : null}
                <p className="tpl-small text-tpl-ink-muted">
                  <time dateTime={article.publishedAt}>
                    {formatDate(article.publishedAt, locale)}
                  </time>
                  {article.category ? <> · {article.category}</> : null}
                </p>
                <h3 className="tpl-h3 mt-2">
                  <span className="tpl-link">{article.title}</span>
                </h3>
                {article.excerpt ? (
                  <p className="mt-3 text-tpl-ink-muted">{article.excerpt}</p>
                ) : null}
              </SmartLink>
            </li>
          ))}
        </ul>
      </Container>
    </SectionFrame>
  );
}
