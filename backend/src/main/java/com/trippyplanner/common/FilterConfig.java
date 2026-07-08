package com.trippyplanner.common;

import com.trippyplanner.auth.SessionRepository;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.filter.CommonsRequestLoggingFilter;

@Configuration
public class FilterConfig {

    @Bean
    public FilterRegistrationBean<CommonsRequestLoggingFilter> requestLoggingFilter() {
        var filter = new CommonsRequestLoggingFilter();
        filter.setIncludeQueryString(true);
        filter.setIncludeClientInfo(true);
        filter.setIncludeHeaders(false); // omit headers to avoid leaking auth tokens in logs
        filter.setIncludePayload(true);
        filter.setMaxPayloadLength(10_000);

        FilterRegistrationBean<CommonsRequestLoggingFilter> bean = new FilterRegistrationBean<>();
        bean.setFilter(filter);
        bean.addUrlPatterns("/*");
        bean.setOrder(0);

        return bean;
    }

    @Bean
    public FilterRegistrationBean<SecurityFilter> securityFilter(SessionRepository sessionRepository) {
        FilterRegistrationBean<SecurityFilter> bean = new FilterRegistrationBean<>();
        bean.setFilter(new SecurityFilter(sessionRepository));
        bean.addUrlPatterns("/*");
        bean.setOrder(1);
        return bean;
    }
}
