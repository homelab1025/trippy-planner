package com.trippyplanner.auth.adapter.web;

import com.trippyplanner.auth.application.AuthService;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
class SecurityFilterConfig {

    @Bean
    FilterRegistrationBean<SecurityFilter> securityFilter(AuthService authService) {
        FilterRegistrationBean<SecurityFilter> bean = new FilterRegistrationBean<>();
        bean.setFilter(new SecurityFilter(authService));
        bean.addUrlPatterns("/*");
        bean.setOrder(1);
        return bean;
    }
}
