import { Injectable } from '@nestjs/common';
import { Group } from 'src/fixture/dto/create-fixture.dto';

@Injectable()
export class FormatTournamentService {
  generateGroupPlayOffPhase1(
    numberOfParticipants: number,
    numberOfGroups: number,
  ) {
    const groups = this.createGroupsWithRanking(
      numberOfParticipants,
      numberOfGroups,
    );
    return groups;
  }

  generateGroupPlayOffPhase2(fixtureGroups: Group[]) {
    const result = fixtureGroups.map((group) => {
      const firstTable = this.repeatArray(
        this.createRoundRobinGroupPlayer1(group.teams.length),
        1,
      );

      const table1 = firstTable.map((values) => {
        return values.map((value) => {
          return group.teams[value - 1];
        });
      });

      const table2 = this.repeatArray(
        this.createRoundRobinGroupPlayer2(group.teams.length, firstTable),
        1,
      ).map((values) => {
        return values.map((value) => {
          return group.teams[value - 1];
        });
      });
      return { table1, table2 };
    });
    return result;
  }

  generateGroupPlayOff(
    numberOfRounds: number,
    numberOfParticipants: number,
    numberOfGroups: number,
  ) {
    const groups = this.createGroupsWithRanking(
      numberOfParticipants,
      numberOfGroups,
    ).map((group) => {
      const firstTable = this.repeatArray(
        this.createRoundRobinGroupPlayer1(group.length),
        numberOfRounds,
      );

      const table1 = firstTable.map((values) => {
        return values.map((value) => {
          return group[value - 1];
        });
      });

      const table2 = this.repeatArray(
        this.createRoundRobinGroupPlayer2(group.length, firstTable),
        numberOfRounds,
      ).map((values) => {
        return values.map((value) => {
          return group[value - 1];
        });
      });

      return { table1, table2 };
    });
    return groups;
  }

  generateTables(
    fixtureType: string,
    numberOfRounds: number,
    numberOfParticipants: number,
  ) {
    if (fixtureType === 'round_robin') {
      const table1 = this.repeatArray(
        this.createRoundRobinGroupPlayer1(numberOfParticipants),
        numberOfRounds,
      );
      const table2 = this.repeatArray(
        this.createRoundRobinGroupPlayer2(numberOfParticipants, table1),
        numberOfRounds,
      );
      return { table1, table2 };
    } else if (fixtureType === 'knockout') {
      return this.createknockoutGroupPlayer(numberOfParticipants);
    }
  }

  private repeatArray(arr: number[][], n: number) {
    if (!arr.length || n <= 0) {
      return [];
    }

    const repeatedArray = [];
    for (let i = 0; i < n; i++) {
      repeatedArray.push(...arr);
    }

    return repeatedArray;
  }

  private createRoundRobinGroupPlayer1(
    numberOfParticipants: number,
  ): number[][] {
    const rows =
      numberOfParticipants % 2 == 0
        ? numberOfParticipants - 1
        : numberOfParticipants;
    const columns =
      numberOfParticipants % 2 == 0
        ? numberOfParticipants / 2
        : (numberOfParticipants + 1) / 2;
    const table: number[][] = [];

    for (let i = 0; i < rows; i++) {
      const row = [];
      for (let j = 1; j <= columns; j++) {
        const value =
          (j + i * columns) % rows === 0 ? rows : (j + i * columns) % rows;
        row.push(value);
      }
      table.push(row);
    }

    return table;
  }

  private createRoundRobinGroupPlayer2(
    numberOfParticipants: number,
    table1: number[][],
  ): number[][] {
    const rows =
      numberOfParticipants % 2 == 0
        ? numberOfParticipants - 1
        : numberOfParticipants;
    const columns =
      numberOfParticipants % 2 == 0
        ? numberOfParticipants / 2
        : (numberOfParticipants + 1) / 2;

    const table: number[][] = [];
    const table2 = [...table1];
    table2.push(table2[0]);

    for (let i = 0; i < rows; i++) {
      const row: number[] = [];
      for (let j = 0; j < columns; j++) {
        row.push(table2[i + 1][columns - 1 - j]);
      }
      table.push(row);
    }
    if (numberOfParticipants % 2 === 0) {
      for (let i = 0; i < rows; i++) {
        table[i][0] = numberOfParticipants;
      }
    }

    return table;
  }

  private createknockoutGroupPlayer(numberOfParticipants: number) {
    const numberOfRounds = Math.ceil(Math.log2(numberOfParticipants));
    const maxParticipants = Math.pow(
      2,
      Math.ceil(Math.log2(numberOfParticipants)),
    );
    const table1 = [];
    const table2 = [];

    const row1: number[] = new Array(maxParticipants / 2).fill(0);
    const row2: number[] = new Array(maxParticipants / 2).fill(0);

    const interval = maxParticipants / 4;
    let j = numberOfParticipants;
    //let step = 0;
    for (let i = 0, step = 0; i < interval; i++, step++) {
      row1[i] = i + 1 + step;
      row1[i + interval] = row1[i] + 1;

      if (j > maxParticipants / 2) {
        row2[i] = j;
        j--;
      }
      if (j > maxParticipants / 2) {
        row2[i + interval] = j;
        j--;
      }
    }
    table1.push(row1);
    table2.push(row2);

    for (let i = 1; i < numberOfRounds; i++) {
      const row1: number[] = new Array(table1[i - 1].length / 2).fill(-1);
      const row2: number[] = new Array(table1[i - 1].length / 2).fill(-1);
      table1.push(row1);
      table2.push(row2);
    }

    for (let i = 0; i < table1[0].length; i++) {
      if (table2[0][i] === 0) {
        if (i % 2 === 0) {
          table1[1][Math.floor(i / 2)] = table1[0][i];
        } else {
          table2[1][Math.floor(i / 2)] = table1[0][i];
        }
      }
    }

    return { table1, table2 };
  }

  private createGroupsWithRanking(numberOfPlayers: number, numGroups: number) {
    const groups = Array.from({ length: numGroups }, () => []);

    for (let i = 0; i < numberOfPlayers; i++) {
      //const groupName = String.fromCharCode(65 + i);
      const index = i % numGroups;
      groups[index].push(i + 1);
    }

    return groups;
  }
}
