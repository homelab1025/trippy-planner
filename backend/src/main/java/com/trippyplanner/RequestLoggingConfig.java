package com.trippyplanner;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.filter.CommonsRequestLoggingFilter;

@Configuration
class RequestLoggingConfig {

    @Bean
    FilterRegistrationBean<CommonsRequestLoggingFilter> requestLoggingFilter() {
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
}
