'use client';

import NextLink from 'next/link';
import type { ComponentProps, MouseEvent } from 'react';
import { isInternalAppPath, normalizeNavigationPath } from '@/lib/atlas-runtime/spatial-navigation';
import { spatialNavigationInterceptor } from '@/lib/atlas-runtime/spatial-navigation-interceptor';
import { useAtlasNavigation } from '../useAtlasNavigation';

type AtlasLinkProps = ComponentProps<typeof NextLink>;

function resolveHref(href: AtlasLinkProps['href']): string {
  if (typeof href === 'string') {
    return href;
  }

  if (href && typeof href === 'object' && 'pathname' in href && href.pathname) {
    return href.pathname;
  }

  return String(href);
}

/** Mandatory Atlas navigation link — routes through spatial transition layer. */
export function AtlasLink({ href, onClick, ...rest }: AtlasLinkProps) {
  const { arriveAt } = useAtlasNavigation();
  const hrefValue = resolveHref(href);
  const isInternal = isInternalAppPath(hrefValue);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || !isInternal) {
      return;
    }

    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();
    spatialNavigationInterceptor.markAtlasLinkNavigation();
    arriveAt(hrefValue);
  };

  return (
    <NextLink
      href={href}
      onClick={handleClick}
      data-atlas-nav="atlas-link"
      {...rest}
    />
  );
}

export function isAtlasInternalHref(href: string): boolean {
  return isInternalAppPath(href);
}

export function toAtlasPath(href: string): string {
  return normalizeNavigationPath(href);
}
