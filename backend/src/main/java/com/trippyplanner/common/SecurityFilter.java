package com.trippyplanner.common;

import com.trippyplanner.auth.SessionRepository;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Optional;

public class SecurityFilter implements Filter {

    private final SessionRepository sessionRepository;

    public SecurityFilter(SessionRepository sessionRepository) {
        this.sessionRepository = sessionRepository;
    }

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        var request = (HttpServletRequest) req;
        var response = (HttpServletResponse) res;

        String uri = request.getRequestURI();
        boolean isPublic = uri.endsWith("/auth/magic-link") || uri.startsWith("/api/share/");

        if (isPublic || "OPTIONS".equals(request.getMethod())) {
            chain.doFilter(req, res);
            return;
        }

        String authHeader = request.getHeader("Authorization");
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
