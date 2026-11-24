package com.trippyplanner.adapter.web;

import com.trippyplanner.domain.model.RouteAccessDeniedException;
import com.trippyplanner.domain.model.RouteNotFoundException;
import com.trippyplanner.domain.model.UserNotFoundException;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.io.IOException;

/**
 * Maps domain exceptions to HTTP statuses for every controller. Uses {@code sendError} rather than a
 * {@code ResponseEntity} so Spring Boot renders its standard error body.
 */
@RestControllerAdvice
class DomainExceptionHandler {

    @ExceptionHandler({RouteNotFoundException.class, UserNotFoundException.class})
    void handleNotFound(HttpServletResponse response) throws IOException {
        response.sendError(HttpServletResponse.SC_NOT_FOUND);
    }

    @ExceptionHandler(RouteAccessDeniedException.class)
    void handleAccessDenied(HttpServletResponse response) throws IOException {
        response.sendError(HttpServletResponse.SC_FORBIDDEN);
    }
}
