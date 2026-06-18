FROM ghcr.io/graalvm/native-image-community:21 AS build
WORKDIR /app
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN ./mvnw dependency:go-offline -q
COPY src ./src
RUN ./mvnw -Pnative native:compile -q

FROM gcr.io/distroless/base-debian12
COPY --from=build /app/target/backend /app/backend
ENTRYPOINT ["/app/backend"]
