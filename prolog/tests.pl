:- use_module(library(plunit)).
:- use_module(connect4).

empty_row([0,0,0,0,0,0,0]).

board_with_bottom(Bottom, Board) :-
    empty_row(E),
    Board = [E, E, E, E, E, Bottom].

:- begin_tests(connect4).

test(board_shape) :-
    empty_board(Board),
    length(Board, 6),
    maplist(row_length, Board),
    !.

row_length(Row) :- length(Row, 7).

test(drop_piece_bottom) :-
    empty_board(Board),
    drop_piece(Board, 4, 1, NewBoard),
    nth0(5, NewBoard, Row),
    nth0(3, Row, 1),
    !.

test(drop_piece_stack) :-
    empty_board(Board),
    drop_piece(Board, 2, 1, B1),
    drop_piece(B1, 2, 2, B2),
    nth0(4, B2, Row),
    nth0(1, Row, 2),
    !.

test(horizontal_win) :-
    board_with_bottom([1,1,1,1,0,0,0], Board),
    win(Board, 1),
    !.

test(vertical_win) :-
    Board = [
        [0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0],
        [2,0,0,0,0,0,0],
        [2,0,0,0,0,0,0],
        [2,0,0,0,0,0,0],
        [2,0,0,0,0,0,0]
    ],
    win(Board, 2),
    !.

test(diagonal_win) :-
    Board = [
        [0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0],
        [1,0,0,0,0,0,0],
        [0,1,0,0,0,0,0],
        [0,0,1,0,0,0,0],
        [0,0,0,1,0,0,0]
    ],
    win(Board, 1),
    !.

test(no_win) :-
    board_with_bottom([1,1,2,2,0,0,0], Board),
    \+ win(Board, 1),
    \+ win(Board, 2),
    !.

test(ai_returns_legal_move) :-
    empty_board(Board),
    best_move(Board, 2, 3, Column, _Score, Nodes),
    between(1, 7, Column),
    Nodes > 0,
    !.

test(ai_takes_win) :-
    board_with_bottom([2,2,2,0,0,0,0], Board),
    best_move(Board, 2, 4, Column, Score, _Nodes),
    Column =:= 4,
    Score > 0,
    !.

test(ai_blocks_human) :-
    board_with_bottom([1,1,1,0,0,0,0], Board),
    best_move(Board, 2, 4, Column, _Score, _Nodes),
    Column =:= 4,
    !.

test(no_moves_on_full_board) :-
    Board = [
        [1,2,1,2,1,2,1],
        [2,1,2,1,2,1,2],
        [1,2,1,2,1,2,1],
        [2,1,2,1,2,1,2],
        [1,2,1,2,1,2,1],
        [2,1,2,1,2,1,2]
    ],
    full(Board),
    valid_moves(Board, Moves),
    Moves = [],
    !.

:- end_tests(connect4).
