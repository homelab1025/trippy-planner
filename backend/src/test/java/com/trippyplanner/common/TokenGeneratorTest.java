package com.trippyplanner.common;

import org.junit.jupiter.api.Test;
import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class TokenGeneratorTest {

    private final TokenGenerator generator = new TokenGenerator();

    @Test
    void generatesTokenOfExpectedLength() {
        String token = generator.generate();
        assertThat(token).hasSize(20);
    }

    @Test
    void generatesOnlyUrlSafeCharacters() {
        String token = generator.generate();
        assertThat(token).matches("[A-Za-z0-9]+");
    }

    @Test
    void generatesDifferentTokensEachTime() {
        Set<String> tokens = new HashSet<>();
        for (int i = 0; i < 100; i++) {
            tokens.add(generator.generate());
        }
        assertThat(tokens).hasSize(100);
    }
}
