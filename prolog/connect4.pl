:- module(connect4, [
    empty_board/1,
    drop_piece/4,
    win/2,
    full/1,
    valid_moves/2,
    best_move/6
]).

empty_board([
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0]
]).

% Las filas van de arriba (índice 0) a abajo (índice 5).
% Las columnas son 1..7. 0 = vacío, 1 = humano, 2 = IA.
drop_piece(Board, Column, Player, NewBoard) :-
    integer(Column), Column >= 1, Column =< 7,
    member(Player, [1, 2]),
    ColIdx is Column - 1,
    column_values(Board, ColIdx, Values),
    last_empty_index(Values, RowIdx),
    nth0(RowIdx, Board, Row),
    replace_at(Row, ColIdx, Player, NewRow),
    replace_at(Board, RowIdx, NewRow, NewBoard).

column_values([], _, []).
column_values([Row|Rows], Col, [Value|Values]) :-
    nth0(Col, Row, Value),
    column_values(Rows, Col, Values).

last_empty_index(Values, Index) :-
    findall(I, (nth0(I, Values, V), V =:= 0), Indexes),
    Indexes \= [],
    last(Indexes, Index).

last([X], X) :- !.
last([_|Tail], X) :- last(Tail, X).

replace_at([_|Tail], 0, Value, [Value|Tail]) :- !.
replace_at([Head|Tail], Index, Value, [Head|Rest]) :-
    Index > 0,
    Next is Index - 1,
    replace_at(Tail, Next, Value, Rest).

win(Board, Player) :-
    member(Player, [1, 2]),
    (   horizontal_win(Board, Player)
    ;   vertical_win(Board, Player)
    ;   diagonal_win(Board, Player)
    ).

horizontal_win(Board, Player) :-
    member(Row, Board),
    line_of_four(Row, Player).

line_of_four([A,B,C,D|_], Player) :-
    A =:= Player, B =:= Player, C =:= Player, D =:= Player.
line_of_four([_|Tail], Player) :-
    line_of_four(Tail, Player).

vertical_win(Board, Player) :-
    between(0, 6, Col),
    between(0, 2, Row),
    R1 is Row + 1,
    R2 is Row + 2,
    R3 is Row + 3,
    cell(Board, Row, Col, Player),
    cell(Board, R1, Col, Player),
    cell(Board, R2, Col, Player),
    cell(Board, R3, Col, Player).

diagonal_win(Board, Player) :-
    (   between(0, 2, Row), between(0, 3, Col),
        cell(Board, Row, Col, Player),
        R1 is Row + 1, C1 is Col + 1, cell(Board, R1, C1, Player),
        R2 is Row + 2, C2 is Col + 2, cell(Board, R2, C2, Player),
        R3 is Row + 3, C3 is Col + 3, cell(Board, R3, C3, Player)
    ;   between(0, 2, Row), between(3, 6, Col),
        cell(Board, Row, Col, Player),
        R1 is Row + 1, C1 is Col - 1, cell(Board, R1, C1, Player),
        R2 is Row + 2, C2 is Col - 2, cell(Board, R2, C2, Player),
        R3 is Row + 3, C3 is Col - 3, cell(Board, R3, C3, Player)
    ).

cell(Board, Row, Col, Value) :-
    nth0(Row, Board, Line),
    nth0(Col, Line, Value).

full(Board) :-
    flatten(Board, Cells),
    \+ member(0, Cells).

% Orden centro-primero para que la IA prefiera el centro en empates.
valid_moves(Board, Moves) :-
    include(column_open(Board), [4, 3, 5, 2, 6, 1, 7], Moves).

column_open(Board, Column) :-
    ColIdx is Column - 1,
    column_values(Board, ColIdx, Values),
    member(0, Values).

best_move(Board, Player, Depth, Column, Score, Nodes) :-
    nb_setval(c4_nodes, 0),
    valid_moves(Board, Moves),
    Moves \= [],
    choose_best_move(Board, Player, Depth, Moves, 0, -10000000, -1000000, 1000000, Column, Score),
    nb_getval(c4_nodes, Nodes).

choose_best_move(_, _, _, [], BestColumn, BestScore, _, _, BestColumn, BestScore).
choose_best_move(Board, Player, Depth, [Move|Moves], BestCol0, BestScore0, Alpha0, Beta, BestCol, BestScore) :-
    negamax_move(Board, Depth, Player, Move, Alpha0, Beta, Value),
    (   Value > BestScore0
    ->  BestCol1 = Move,
        BestScore1 = Value
    ;   BestCol1 = BestCol0,
        BestScore1 = BestScore0
    ),
    Alpha1 is max(Alpha0, BestScore1),
    choose_best_move(Board, Player, Depth, Moves, BestCol1, BestScore1, Alpha1, Beta, BestCol, BestScore).

negamax(Board, Depth, Player, Alpha, Beta, Score) :-
    inc_nodes,
    valid_moves(Board, Moves),
    (   Moves = []
    ->  Score = 0
    ;   Depth =< 0
    ->  heuristic(Board, Player, Score)
    ;   negamax_loop(Board, Depth, Player, Moves, Alpha, Beta, Score)
    ).

negamax_loop(Board, Depth, Player, [Move|Moves], Alpha, Beta, Score) :-
    negamax_move(Board, Depth, Player, Move, Alpha, Beta, Value),
    (   Value >= Beta
    ->  Score = Value
    ;   Alpha1 is max(Alpha, Value),
        negamax_loop(Board, Depth, Player, Moves, Alpha1, Beta, RestScore),
        Score is max(Value, RestScore)
    ).
negamax_loop(_, _, _, [], _, _, -1000000).

negamax_move(Board, Depth, Player, Column, Alpha, Beta, Value) :-
    inc_nodes,
    drop_piece(Board, Column, Player, NewBoard),
    (   win(NewBoard, Player)
    ->  Value is 100000 + Depth
    ;   full(NewBoard)
    ->  Value = 0
    ;   NextDepth is Depth - 1,
        Other is 3 - Player,
        NegAlpha is -Beta,
        NegBeta is -Alpha,
        negamax(NewBoard, NextDepth, Other, NegAlpha, NegBeta, ChildValue),
        Value is -ChildValue
    ).

inc_nodes :-
    nb_getval(c4_nodes, Nodes),
    Next is Nodes + 1,
    nb_setval(c4_nodes, Next).

heuristic(Board, Player, Score) :-
    Other is 3 - Player,
    windows(Board, Windows),
    sum_window_values(Windows, Player, Other, 0, WindowScore),
    center_count(Board, Player, CenterPlayer),
    center_count(Board, Other, CenterOther),
    Score is WindowScore + 6 * (CenterPlayer - CenterOther).

sum_window_values([], _, _, Acc, Acc).
sum_window_values([Window|Rest], Player, Other, Acc, Score) :-
    window_value(Window, Player, Other, Value),
    Acc1 is Acc + Value,
    sum_window_values(Rest, Player, Other, Acc1, Score).

window_value(Window, Player, Other, Value) :-
    count_value(Window, Player, CountPlayer),
    count_value(Window, Other, CountOther),
    (   CountPlayer > 0, CountOther > 0
    ->  Value = 0
    ;   CountPlayer =:= 4
    ->  Value = 10000
    ;   CountPlayer =:= 3
    ->  Value = 50
    ;   CountPlayer =:= 2
    ->  Value = 10
    ;   CountPlayer =:= 1
    ->  Value = 1
    ;   CountOther =:= 4
    ->  Value = -10000
    ;   CountOther =:= 3
    ->  Value = -50
    ;   CountOther =:= 2
    ->  Value = -10
    ;   CountOther =:= 1
    ->  Value = -1
    ;   Value = 0
    ).

count_value([], _, 0).
count_value([X|Tail], X, Count) :- !,
    count_value(Tail, X, Rest),
    Count is Rest + 1.
count_value([_|Tail], X, Count) :-
    count_value(Tail, X, Count).

windows(Board, Windows) :-
    findall(Window, window(Board, Window), Windows).

window(Board, Window) :-
    (   between(0, 5, Row), between(0, 3, Col),
        segment(Board, Row, Col, 0, 1, Window)
    ;   between(0, 2, Row), between(0, 6, Col),
        segment(Board, Row, Col, 1, 0, Window)
    ;   between(0, 2, Row), between(0, 3, Col),
        segment(Board, Row, Col, 1, 1, Window)
    ;   between(0, 2, Row), between(3, 6, Col),
        segment(Board, Row, Col, 1, -1, Window)
    ).

segment(Board, Row, Col, DeltaRow, DeltaCol, [V0,V1,V2,V3]) :-
    R1 is Row + DeltaRow, C1 is Col + DeltaCol,
    R2 is R1 + DeltaRow, C2 is C1 + DeltaCol,
    R3 is R2 + DeltaRow, C3 is C2 + DeltaCol,
    cell(Board, Row, Col, V0),
    cell(Board, R1, C1, V1),
    cell(Board, R2, C2, V2),
    cell(Board, R3, C3, V3).

center_count(Board, Player, Count) :-
    findall(Value, (member(Row, Board), nth0(3, Row, Value)), Values),
    count_value(Values, Player, Count).
