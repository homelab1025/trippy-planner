package com.trippyplanner;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import static com.tngtech.archunit.base.DescribedPredicate.alwaysTrue;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.resideInAPackage;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.Architectures.onionArchitecture;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

/**
 * Enforces the backend-level onion: {@code domain.model} at the core, then {@code application} (use-case
 * services plus the ports they need), then {@code adapter.*} at the edge. This is the whole backend's
 * layering rather than a per-module one, so the old module boundaries ({@code share} → {@code routes} →
 * {@code auth} → {@code common}) were subsumed when the rings were flattened and there is no separate
 * module test any more. The generated OpenAPI packages are a shared wire contract, not a ring.
 */
@AnalyzeClasses(packages = "com.trippyplanner", importOptions = ImportOption.DoNotIncludeTests.class)
class OnionArchitectureTest {

    private static final String GENERATED_API = "com.trippyplanner.api..";
    private static final String GENERATED_MODEL = "com.trippyplanner.model..";

    // Rings are optional: not every concern has every layer (share and version are single web adapters).
    @ArchTest
    static final ArchRule backendFollowsOnionArchitecture = onionArchitecture()
        .domainModels("..domain.model..")
        .domainServices("..domain.service..")
        .applicationServices("..application..")
        .adapter("web", "..adapter.web..")
        .adapter("persistence", "..adapter.persistence..")
        .adapter("email", "..adapter.email..")
        .withOptionalLayers(true)
        // e2e/local scaffolding plugs into the EmailService port; it is exempt from the onion
        .ignoreDependency(resideInAPackage("com.trippyplanner.testsupport.."), alwaysTrue())
        // The generated wire contract (com.trippyplanner.api..) sits outside the onion and references the
        // principal type via x-spring-provide-args; that coupling is inherent to generating controllers.
        .ignoreDependency(resideInAPackage(GENERATED_API), alwaysTrue());

    // Onion only constrains dependencies between its own rings; these keep frameworks out of the core too
    @ArchTest
    static final ArchRule domainDependsOnlyOnJdk = classes()
        .that().resideInAPackage("..domain..")
        .should().onlyDependOnClassesThat().resideInAnyPackage("java..", "..domain..");

    @ArchTest
    static final ArchRule applicationIsTransportAndStorageAgnostic = noClasses()
        .that().resideInAPackage("..application..")
        .should().dependOnClassesThat().resideInAnyPackage(
            GENERATED_API, GENERATED_MODEL,
            "org.springframework.web..", "org.springframework.http..", "org.springframework.jdbc..",
            "jakarta.servlet..")
        .because("HTTP and SQL details belong in adapters; use cases speak domain types");

    @ArchTest
    static final ArchRule generatedContractIsUsedOnlyByWebAdapters = noClasses()
        .that().resideOutsideOfPackages("..adapter.web..", GENERATED_API, GENERATED_MODEL, "com.trippyplanner.testsupport..")
        .should().dependOnClassesThat().resideInAnyPackage(GENERATED_API, GENERATED_MODEL)
        .because("the OpenAPI DTOs are the web adapter's wire format, not the domain model");

    // Onion constrains cross-ring direction; this closes the same-ring gap it leaves behind.
    // The generated *Api interfaces are web-adapter code that happens to be generated: controllers implement them
    // and they take adapter.web.CurrentUser via x-spring-provide-args, so that edge is ignored like in the onion rule.
    @ArchTest
    static final ArchRule topLevelPackagesAreFreeOfCycles = slices()
        .matching("com.trippyplanner.(*)..")
        .should().beFreeOfCycles()
        .ignoreDependency(resideInAPackage(GENERATED_API), alwaysTrue());
}
