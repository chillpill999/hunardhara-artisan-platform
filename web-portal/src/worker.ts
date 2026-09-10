interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // List of protected routes that MUST NOT be accessed anonymously
    const isProtectedRoute =
      pathname === '/artisan' ||
      pathname.startsWith('/artisan/') ||
      pathname === '/admin' ||
      pathname.startsWith('/admin/') ||
      pathname === '/studio' ||
      pathname === '/earnings' ||
      pathname === '/dashboard' ||
      pathname === '/inventory' ||
      pathname === '/profile' ||
      pathname === '/orders' ||
      pathname.startsWith('/orders/') ||
      pathname === '/cart' ||
      pathname.startsWith('/cart/') ||
      pathname === '/account' ||
      pathname.startsWith('/account/');

    if (isProtectedRoute) {
      const authHeader = request.headers.get('Authorization');
      const cookieHeader = request.headers.get('Cookie') || '';

      const hasToken =
        Boolean(authHeader && authHeader.startsWith('Bearer ')) ||
        cookieHeader.includes('hunardhara_auth_token') ||
        cookieHeader.includes('sb-access-token');

      const isStaticAsset = pathname.includes('.') && !pathname.endsWith('.html');

      // If user is unauthenticated and not requesting an underlying static sub-asset, redirect immediately at the edge
      if (!hasToken && !isStaticAsset) {
        const loginUrl = new URL('/login', url.origin);
        loginUrl.searchParams.set('redirect', pathname);
        loginUrl.searchParams.set(
          'msg',
          pathname.startsWith('/admin')
            ? 'Sign in as Administrator to access governance and cluster monitoring.'
            : 'Sign in to continue. Access your Artisan Studio, products, AI cataloging tools and earnings.'
        );
        return Response.redirect(loginUrl.toString(), 302);
      }
    }

    // Pass through to static assets
    return env.ASSETS.fetch(request);
  },
};
