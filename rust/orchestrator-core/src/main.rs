use std::io::{self, Read};

use orchestrator_core::{plan, Node};

fn split_field<'a>(line: &'a str, kind: &str, expected: usize) -> Result<Vec<&'a str>, String> {
    let fields: Vec<_> = line.split('\t').collect();
    if fields.len() != expected || fields.first() != Some(&kind) {
        return Err(format!("invalid {kind} record"));
    }
    if fields[1..]
        .iter()
        .any(|field| field.is_empty() || field.chars().any(|character| character.is_control()))
    {
        return Err(format!("invalid {kind} field"));
    }
    Ok(fields)
}

fn main() -> Result<(), String> {
    let mut input = String::new();
    io::stdin()
        .read_to_string(&mut input)
        .map_err(|error| error.to_string())?;
    let mut nodes = Vec::new();
    let mut waits_for = Vec::new();
    let mut ended = false;

    for line in input.lines() {
        if line.is_empty() {
            continue;
        }
        if line == "END" {
            ended = true;
            continue;
        }
        if let Ok(fields) = split_field(line, "NODE", 3) {
            nodes.push(Node {
                id: fields[1].to_owned(),
                status: fields[2].to_owned(),
            });
            continue;
        }
        if let Ok(fields) = split_field(line, "WAIT", 3) {
            waits_for.push((fields[1].to_owned(), fields[2].to_owned()));
            continue;
        }
        return Err("invalid graph plan input".to_owned());
    }
    if !ended {
        return Err("graph plan input must end with END".to_owned());
    }

    let result = plan(&nodes, &waits_for).map_err(|error| format!("invalid graph: {error:?}"))?;
    for id in result.ready {
        println!("READY\t{id}");
    }
    for id in result.blocked {
        println!("BLOCKED\t{id}");
    }
    for id in result.pending {
        println!("PENDING\t{id}");
    }
    Ok(())
}
