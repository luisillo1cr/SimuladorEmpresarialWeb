export function getTeamInternalChatId(teamId: string) {
  return `team_internal_${teamId}`;
}

export function getTeamProfessorChatId(teamId: string) {
  return `team_professor_${teamId}`;
}

export function getDirectProfessorChatId(studentUid: string, professorUid: string) {
  const sorted = [studentUid, professorUid].sort();
  return `direct_professor_${sorted[0]}_${sorted[1]}`;
}

export function getUserChatStateId(uid: string, chatId: string) {
  return `${uid}_${chatId}`;
}