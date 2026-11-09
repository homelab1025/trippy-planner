package com.trippyplanner.auth;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
class SecurityFilterConfig {

    @Bean
    FilterRegistrationBean<SecurityFilter> securityFilter(SessionRepository sessionRepository) {
        FilterRegistrationBean<SecurityFilter> bean = new FilterRegistrationBean<>();
        bean.setFilter(new SecurityFilter(sessionRepository));
        bean.addUrlPatterns("/*");
        bean.setOrder(1);
        return bean;
    }
}
