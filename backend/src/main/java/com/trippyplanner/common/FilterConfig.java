package com.trippyplanner.common;

import com.trippyplanner.auth.SessionRepository;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FilterConfig {

    @Bean
    public FilterRegistrationBean<SecurityFilter> securityFilter(SessionRepository sessionRepository) {
        FilterRegistrationBean<SecurityFilter> bean = new FilterRegistrationBean<>();
        bean.setFilter(new SecurityFilter(sessionRepository));
        bean.addUrlPatterns("/*");
        bean.setOrder(1);
        return bean;
    }
}
