package com.trippyplanner.auth.adapter.web;

import com.trippyplanner.auth.api.CurrentUser;
import com.trippyplanner.auth.application.AuthService;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;

import java.io.IOException;
import java.util.Set;
import java.util.Optional;

final class SecurityFilter implements Filter {

    static final String CURRENT_USER_ATTRIBUTE = CurrentUser.class.getName();

    private static final Set<String> PUBLIC_PATHS = Set.of(
        "/auth/magic-link",
        "/api/share/",
        // Safe outside e2e profile: MagicLinkTokenTestController is @Profile("e2e"), so this path is unmapped and returns 404 unless e2e is active
        "/test/magic-link-token",
        // Shown in the Tech Details panel to signed-out visitors too
        "/version"
    );

    private final AuthService authService;

    SecurityFilter(AuthService authService) {
        this.authService = authService;
    }

    private static boolean isPublicPath(String uri) {
        for (String path : PUBLIC_PATHS) {
            if (uri.endsWith(path) || uri.startsWith(path)) {
                return true;
            }
        }
        return false;
    }

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        var request = (HttpServletRequest) req;
        var response = (HttpServletResponse) res;

        String uri = request.getRequestURI();
        boolean isPublic = isPublicPath(uri);

        if (isPublic || HttpMethod.OPTIONS.matches(request.getMethod())) {
            chain.doFilter(req, res);
            return;
        }

        String authHeader = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            return;
        }

        String token = authHeader.substring(7);
        Optional<CurrentUser> currentUser = authService.authenticate(token);

        if (currentUser.isEmpty()) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            return;
        }

        request.setAttribute(CURRENT_USER_ATTRIBUTE, currentUser.get());
        chain.doFilter(req, res);
    }
}
