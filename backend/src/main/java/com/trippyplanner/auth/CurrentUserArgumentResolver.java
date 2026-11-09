package com.trippyplanner.auth;

import com.trippyplanner.auth.api.CurrentUser;
import org.springframework.core.MethodParameter;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

final class CurrentUserArgumentResolver implements HandlerMethodArgumentResolver {

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return parameter.getParameterType() == CurrentUser.class;
    }

    @Override
    public CurrentUser resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
            NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
        Object currentUser = webRequest.getAttribute(
            SecurityFilter.CURRENT_USER_ATTRIBUTE, RequestAttributes.SCOPE_REQUEST);
        if (currentUser == null) {
            // Means an operation declares CurrentUser but its path is in SecurityFilter.PUBLIC_PATHS
            throw new IllegalStateException("No authenticated user on this request");
        }
        return (CurrentUser) currentUser;
    }
}
