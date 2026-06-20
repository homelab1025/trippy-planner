FROM ghcr.io/graalvm/native-image-community:25 AS build
# C.UTF-8 is built into the kernel and available without locale packages; en_US.UTF-8 would require locales to be installed and generate LC_CTYPE warnings on this image
ENV LANG=C.UTF-8
ENV LANGUAGE=C.UTF-8
ENV LC_ALL=C.UTF-8
WORKDIR /app
COPY openapi.yaml /openapi.yaml
COPY backend/.mvn/ .mvn/
COPY backend/mvnw backend/pom.xml ./
RUN ./mvnw dependency:go-offline -q
COPY backend/src ./src
# -DskipTests prevents the GraalVM native-maven-plugin from running tests during native image compilation.
# Tests should be run separately BEFORE building the container image (see build pipeline documentation).
RUN ./mvnw -Pnative native:compile -q -DskipTests

FROM gcr.io/distroless/base-debian13
COPY --from=build /app/target/backend /app/backend
ENTRYPOINT ["/app/backend"]
