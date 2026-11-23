use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Node {
    pub id: String,
    pub status: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Plan {
    pub ready: Vec<String>,
    pub blocked: Vec<String>,
    pub pending: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PlanError {
    DuplicateNode(String),
    MissingNode(String),
    InvalidNodeId(String),
    InvalidStatus { id: String, status: String },
}

const VALID_STATUSES: [&str; 9] = [
    "pending",
    "ready",
    "running",
    "waiting",
    "blocked",
    "paused",
    "completed",
    "failed",
    "closed",
];

fn is_satisfied(status: &str) -> bool {
    matches!(status, "ready" | "completed" | "closed")
}

fn is_blocking(status: &str) -> bool {
    matches!(status, "blocked" | "failed")
}

fn validate_id(id: &str) -> Result<(), PlanError> {
    if id.is_empty() || id.len() > 128 || id.chars().any(|character| character.is_control()) {
        return Err(PlanError::InvalidNodeId(id.to_owned()));
    }
    Ok(())
}

pub fn plan(nodes: &[Node], waits_for: &[(String, String)]) -> Result<Plan, PlanError> {
    let mut statuses = HashMap::with_capacity(nodes.len());
    for node in nodes {
        validate_id(&node.id)?;
        if !VALID_STATUSES.contains(&node.status.as_str()) {
            return Err(PlanError::InvalidStatus {
                id: node.id.clone(),
                status: node.status.clone(),
            });
        }
        if statuses
            .insert(node.id.clone(), node.status.as_str())
            .is_some()
        {
            return Err(PlanError::DuplicateNode(node.id.clone()));
        }
    }

    let mut dependencies: HashMap<&str, Vec<&str>> = HashMap::new();
    for (from, to) in waits_for {
        validate_id(from)?;
        validate_id(to)?;
        if !statuses.contains_key(from) {
            return Err(PlanError::MissingNode(from.clone()));
        }
        if !statuses.contains_key(to) {
            return Err(PlanError::MissingNode(to.clone()));
        }
        dependencies
            .entry(to.as_str())
            .or_default()
            .push(from.as_str());
    }

    let mut ready = Vec::new();
    let mut blocked = Vec::new();
    let mut pending = Vec::new();
    for node in nodes.iter().filter(|node| node.status == "pending") {
        let dependency_statuses = dependencies
            .get(node.id.as_str())
            .map(Vec::as_slice)
            .unwrap_or(&[]);
        if dependency_statuses
            .iter()
            .any(|id| is_blocking(statuses.get(*id).expect("validated dependency")))
        {
            blocked.push(node.id.clone());
        } else if dependency_statuses
            .iter()
            .all(|id| is_satisfied(statuses.get(*id).expect("validated dependency")))
        {
            ready.push(node.id.clone());
        } else {
            pending.push(node.id.clone());
        }
    }

    Ok(Plan {
        ready,
        blocked,
        pending,
    })
}

pub fn validate_plan(plan: &Plan) -> bool {
    let mut ids = HashSet::new();
    plan.ready
        .iter()
        .chain(&plan.blocked)
        .chain(&plan.pending)
        .all(|id| ids.insert(id))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn node(id: &str, status: &str) -> Node {
        Node {
            id: id.to_owned(),
            status: status.to_owned(),
        }
    }

    #[test]
    fn plans_ready_blocked_and_pending_nodes_in_input_order() {
        let nodes = vec![
            node("done", "completed"),
            node("failed", "failed"),
            node("ready", "pending"),
            node("blocked", "pending"),
            node("waiting", "pending"),
        ];
        let waits_for = vec![
            ("done".to_owned(), "ready".to_owned()),
            ("failed".to_owned(), "blocked".to_owned()),
            ("waiting".to_owned(), "ready".to_owned()),
            ("ready".to_owned(), "waiting".to_owned()),
        ];
        let result = plan(&nodes, &waits_for).expect("valid graph");
        assert_eq!(result.ready, Vec::<String>::new());
        assert_eq!(result.blocked, vec!["blocked"]);
        assert_eq!(result.pending, vec!["ready", "waiting"]);
        assert!(validate_plan(&result));
    }

    #[test]
    fn nodes_without_dependencies_are_ready() {
        let result = plan(&[node("task", "pending")], &[]).expect("valid graph");
        assert_eq!(result.ready, vec!["task"]);
    }

    #[test]
    fn rejects_missing_dependency_nodes() {
        let error = plan(
            &[node("task", "pending")],
            &[("missing".into(), "task".into())],
        )
        .unwrap_err();
        assert_eq!(error, PlanError::MissingNode("missing".into()));
    }
}
