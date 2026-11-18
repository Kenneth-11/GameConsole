:- use_module(library(http/thread_httpd)).
:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_json)).
:- use_module(connect4).

:- http_handler(root(health), health_handler, []).
:- http_handler(root(decide), decide_handler, [methods([post])]).

health_handler(_Request) :-
    reply_json_dict(_{status: "ok", service: "gameconsole-prolog"}).

decide_handler(Request) :-
    catch(
        handle_decide(Request),
        Error,
        (   message_to_string(Error, Message),
            reply_json_dict(_{status: "error", message: Message}, [status(400)])
        )
    ).

handle_decide(Request) :-
    http_read_json_dict(Request, Dict),
    get_dict(board, Dict, Board),
    get_dict(player, Dict, Player),
    (   get_dict(depth, Dict, Depth)
    ->  true
    ;   Depth = 5
    ),
    validate_board(Board),
    validate_player(Player),
    validate_depth(Depth),
    get_time(Start),
    (   best_move(Board, Player, Depth, Column, Score, Nodes)
    ->  get_time(End),
        Ms is round((End - Start) * 1000),
        reply_json_dict(_{
            column: Column,
            score: Score,
            depth: Depth,
            nodes: Nodes,
            ms: Ms
        })
    ;   throw(error(no_moves, "no hay jugadas disponibles en el tablero"))
    ).

validate_board(Board) :-
    is_list(Board),
    length(Board, 6),
    maplist(validate_row, Board).

validate_row(Row) :-
    is_list(Row),
    length(Row, 7),
    maplist(validate_cell, Row).

validate_cell(Value) :-
    integer(Value),
    Value >= 0,
    Value =< 2.

validate_player(Player) :-
    member(Player, [1, 2]).

validate_depth(Depth) :-
    integer(Depth),
    Depth >= 1,
    Depth =< 8.

main :-
    (   getenv('PROLOG_PORT', PortAtom)
    ->  atom_number(PortAtom, Port)
    ;   Port = 8090
    ),
    http_server(http_dispatch, [port(Port)]),
    format("GameConsole Prolog escuchando en ~w~n", [Port]),
    thread_get_message(_).

:- initialization(main, main).
