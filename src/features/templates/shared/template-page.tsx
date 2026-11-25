import type { ReactNode } from 'react';
import type { CSSProperties } from 'react';
import { SkipLink } from '@/components/shared/skip-link';
import type { ShellData, TemplateDefinition } from '../types';
import { MenuEnhancer } from './islands/menu-enhancer';

/**
 * A whole page in a given template, outside the public layout: the preview and demo routes render
 * a template other than the school's saved one. Same shell structure as src/app/(public)/layout.tsx.
 */
export function TemplatePage({
  template,
  shell,
  style,
  children,
}: {
  template: TemplateDefinition;
  shell: ShellData;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const { Header, Footer } = template;
  return (
    <div
      data-template={template.key}
      className="site-scope flex min-h-dvh flex-col"
      {...(style ? { style } : {})}
    >
      <SkipLink />
      <Header shell={shell} />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <Footer shell={shell} />
      <MenuEnhancer />
    </div>
  );
}
