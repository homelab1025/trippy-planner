package com.trippyplanner.common;

import com.trippyplanner.auth.SessionRepository;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;

import java.io.IOException;
import java.util.Set;
import java.util.Optional;

public class SecurityFilter implements Filter {

    private static final Set<String> PUBLIC_PATHS = Set.of(
        "/auth/magic-link",
        "/api/share/"
    );

    private final SessionRepository sessionRepository;

    public SecurityFilter(SessionRepository sessionRepository) {
        this.sessionRepository = sessionRepository;
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
        Optional<Long> userId = sessionRepository.findValidUserId(token);

        if (userId.isEmpty()) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            return;
        }

        request.setAttribute("userId", userId.get());
        request.setAttribute("sessionToken", token);
        chain.doFilter(req, res);
    }
}
