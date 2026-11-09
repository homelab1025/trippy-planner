package com.trippyplanner.version;

import org.springframework.context.annotation.Configuration;
import org.springframework.modulith.ApplicationModule;

/**
 * Binds the version module to Spring Modulith. It depends on no other domain module — only on the
 * generated {@code model}/{@code api} OpenAPI contract and build properties injected by Spring Boot.
 */
@ApplicationModule(allowedDependencies = {"model", "api"})
@Configuration(proxyBeanMethods = false)
class VersionModuleConfiguration {
}
