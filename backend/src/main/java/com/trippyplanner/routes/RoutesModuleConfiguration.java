package com.trippyplanner.routes;

import org.springframework.context.annotation.Configuration;
import org.springframework.modulith.ApplicationModule;

/**
 * Binds the routes module to Spring Modulith. It may reach the {@code auth} module only through the
 * root-level {@code CurrentUser}, plus the {@code common} module's {@code TokenGenerator} and the
 * generated {@code model}/{@code api} OpenAPI contract. Routes expose their root-level
 * {@code RouteQueryService} as the only cross-module surface (route persistence stays internal).
 */
@ApplicationModule(allowedDependencies = {"auth", "common", "model", "api"})
@Configuration(proxyBeanMethods = false)
class RoutesModuleConfiguration {
}
