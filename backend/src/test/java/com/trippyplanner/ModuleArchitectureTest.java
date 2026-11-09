package com.trippyplanner;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;
import org.springframework.modulith.docs.Documenter;

/**
 * Verifies the backend module layout with Spring Modulith: each top-level package under
 * {@code com.trippyplanner} is a module. Spring Modulith's convention is that the module's
 * <em>public surface is its root package</em> (2.x has no per-subpackage public-API marker), so the
 * public types ({@code auth.CurrentUser}, {@code routes.RouteQueryService}) live at the module root
 * and are the only surface other modules may use. See
 * {@code docs/adr/2026-11-09-backend-module-boundaries-spring-modulith.md}.
 *
 * <p>The module model is built from the compiled classpath rather than a running Spring
 * context, so this test needs no database. {@code .verify()} fails the build if a module
 * reaches another module's internals, if a module's public API leaks an internal type, or
 * if a module violates the {@code allowedDependencies} declared on its {@code @ApplicationModule}.
 * The same model is written as PlantUML diagrams under {@code target/spring-modulith-docs/}.
 */
class ModuleArchitectureTest {

    @Test
    void modulesAreCompliantAndDocumented() throws Exception {
        var modules = ApplicationModules.of(TrippyPlannerApplication.class).verify();
        new Documenter(modules)
            .writeModulesAsPlantUml()
            .writeIndividualModulesAsPlantUml();
    }
}
