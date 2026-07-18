package com.trippyplanner.common;

import com.trippyplanner.auth.SessionRepository;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;

import java.io.IOException;
import java.util.Locale;
import java.util.Set;
import java.util.Optional;

public class SecurityFilter implements Filter {

    private static final Set<String> PUBLIC_PATHS = Set.of(
        "/auth/magic-link",
        "/api/share/",
        // Safe outside e2e profile: MagicLinkTokenTestController is @Profile("e2e"), so this path is unmapped and returns 404 unless e2e is active
        "/test/magic-link-token"
    );

    // Docker's own healthcheck hits this via "localhost"; trippy.lab.wicked is the
    // hostname operators use to reach the app directly. Any other Host is treated
    // like a normal protected endpoint (falls through to the Bearer-token check).
    private static final String ACTUATOR_HEALTH_PATH = "/actuator/health";
    private static final Set<String> ACTUATOR_HEALTH_ALLOWED_HOSTS = Set.of("localhost", "trippy.lab.wicked");

    private final SessionRepository sessionRepository;

    public SecurityFilter(SessionRepository sessionRepository) {
        this.sessionRepository = sessionRepository;
    }

    private static boolean isPublicPath(String uri, String host) {
        if (uri.endsWith(ACTUATOR_HEALTH_PATH)) {
            return isAllowedHealthHost(host);
        }
        for (String path : PUBLIC_PATHS) {
            if (uri.endsWith(path) || uri.startsWith(path)) {
                return true;
            }
        }
        return false;
    }

    private static boolean isAllowedHealthHost(String host) {
        if (host == null) {
            return false;
        }
        return ACTUATOR_HEALTH_ALLOWED_HOSTS.contains(hostnameOnly(host));
    }

    // Host header hostnames are case-insensitive (RFC 9110) and IPv6 literals are
    // bracketed (e.g. "[::1]:8080"), so a plain split on ":" both mismatches on case
    // and mis-parses IPv6 - strip brackets/port and lowercase before comparing.
    private static String hostnameOnly(String host) {
        String trimmed = host.trim();
        if (trimmed.startsWith("[")) {
            int closingBracket = trimmed.indexOf(']');
            String bracketed = closingBracket >= 0 ? trimmed.substring(1, closingBracket) : trimmed;
            return bracketed.toLowerCase(Locale.ROOT);
        }
        int colonIndex = trimmed.indexOf(':');
        String hostname = colonIndex >= 0 ? trimmed.substring(0, colonIndex) : trimmed;
        return hostname.toLowerCase(Locale.ROOT);
    }

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        var request = (HttpServletRequest) req;
        var response = (HttpServletResponse) res;

        String uri = request.getRequestURI();
        String host = request.getHeader(HttpHeaders.HOST);
        boolean isPublic = isPublicPath(uri, host);

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
