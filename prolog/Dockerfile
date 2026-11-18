FROM swipl:9.2.9

WORKDIR /app
COPY connect4.pl server.pl ./

ENV PROLOG_PORT=8090
EXPOSE 8090

ENTRYPOINT ["swipl"]
CMD ["-q", "/app/server.pl"]
